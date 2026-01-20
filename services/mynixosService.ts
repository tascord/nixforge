import { NixService, NixOptionMetadata } from '../types';
import { parseNixModuleRaw } from '../utils/nixParser';

// Used for index discovery - we'll try to determine the current elasticsearch index from the main page if possible,
// or fallback to a known pattern.
const SEARCH_ROOT = 'https://search.nixos.org';
const BACKEND_ROOT = `${SEARCH_ROOT}/backend/elasticsearch`;

let cachedIndexName: string | null = null;

let lastDiscoveryAttempt = 0;

async function getIndexName(): Promise<string> {
  // If we have a cached index and it's fresh (less than 1 hour old), use it
  if (cachedIndexName && Date.now() - lastDiscoveryAttempt < 3600000) return cachedIndexName;

  // If we are currently discovering, return the previous cache or a default
  if (lastDiscoveryAttempt > 0 && Date.now() - lastDiscoveryAttempt < 10000) {
      return cachedIndexName || "options-nixos-unstable";
  }

  try {
    lastDiscoveryAttempt = Date.now();
    // Use a much shorter timeout for index discovery - it shouldn't block user search
    const htmlPromise = window.electronAPI.fetchExternal(SEARCH_ROOT);
    const timeoutPromise = new Promise<string>((_, reject) => 
        setTimeout(() => reject(new Error('Discovery timeout')), 3000)
    );

    const html = await Promise.race([htmlPromise, timeoutPromise]) as string;
    
    // Improved regex to find the index name more reliably
    const match = html.match(/options_index\s*=\s*"([^"]+)"/) || html.match(/latest-\d+-nixos-unstable/);
    if (match) {
      cachedIndexName = match[1] || match[0];
      return cachedIndexName!;
    }
  } catch (e) {
    console.warn("Failed to discover index name faster, using fallback.", e);
  }

  // Fallback to a set of reliable indices if discovery fails
  cachedIndexName = cachedIndexName || "options-nixos-unstable";
  return cachedIndexName; 
}

export async function searchNixOptions(query: string): Promise<NixService[]> {
  if (!query) return [];
  
  try {
    const index = await getIndexName();
    const url = `${BACKEND_ROOT}/${index}/_search`;
    
    // ElasticSearch Query for Options
    // Removed strict "services." prefix to allow programs.*, networking.*, etc.
    const esQuery = {
      query: {
        bool: {
          must: [
            { 
               multi_match: {
                 query: query,
                 fields: ["option", "description"],
                 fuzziness: "AUTO"
               }
            }
          ]
        }
      },
      size: 30
    };

    const data = await window.electronAPI.fetchExternal(url, {
        method: 'POST',
        body: esQuery,
        headers: { 'Content-Type': 'application/json' }
    });
    
    return (data.hits?.hits || []).map((hit: any) => {
        const source = hit._source;
        const parts = source.option.split('.');
        
        // Intelligent grouping:
        // services.nginx.enable -> services.nginx
        // programs.git.enable -> programs.git
        // networking.hostName -> networking
        // security.rtkit.enable -> security.rtkit
        
        let serviceName = source.option;
        // If it ends with .enable, strip it and use the parent as the "Service" name
        if (serviceName.endsWith('.enable')) {
             serviceName = serviceName.replace('.enable', '');
        } else {
             // Otherwise, try to guess the module name. 
             // Length 1: "networking" -> "networking"
             // Length 2: "boot.loader" -> "boot.loader"
             // Length > 2: "services.xserver.desktopManager" -> "services.xserver"
             if (parts.length > 2) {
                 serviceName = parts.slice(0, 2).join('.');
             } else if (parts.length > 1) {
                 serviceName = parts.slice(0, parts.length - 1).join('.');
             }
        }

        return {
            name: serviceName,
            description: source.description || "No description available",
            enabled: false,
            options: {}
        };
    }).filter((v: any, i: number, a: any[]) => a.findIndex((t: any) => t.name === v.name) === i); // Deduplicate

  } catch (error) {
    console.error("Failed to search options:", error);
    return [];
  }
}

export async function fetchServiceOptions(serviceName: string): Promise<NixOptionMetadata[]> {
  try {
    const index = await getIndexName();
    const url = `${BACKEND_ROOT}/${index}/_search`;

    const esQuery = {
        query: {
            prefix: { "option": serviceName }
        },
        size: 50
    };

    const data = await window.electronAPI.fetchExternal(url, {
        method: 'POST',
        body: esQuery,
        headers: { 'Content-Type': 'application/json' }
    });
    
    return (data.hits?.hits || []).map((hit: any) => {
        const source = hit._source;
        return {
            name: source.option,
            description: source.description,
            type: source.type || 'string',
            example: source.default ? JSON.stringify(source.default) : ''
        };
    });

  } catch (error) {
    console.error("Failed to fetch service options:", error);
    return [];
  }
}

// Convert GitHub Blob URL to Raw User Content URL
const getRawUrl = (blobUrl: string): string => {
    return blobUrl
        .replace('github.com', 'raw.githubusercontent.com')
        .replace('/blob/', '/');
};

export async function fetchOptionsFromSource(limitToService: string): Promise<NixOptionMetadata[]> {
    try {
        console.log(`Attempting to fetch source for ${limitToService}...`);
        
        // 1. Find the definition file via Search
        const index = await getIndexName();
        const url = `${BACKEND_ROOT}/${index}/_search`;
        
        // Search for the 'enable' option as it's the most standard anchor
        const esQuery = {
            query: {
                term: { "option": `${limitToService}.enable` }
            },
            size: 1
        };

        const data = await window.electronAPI.fetchExternal(url, {
            method: 'POST',
            body: esQuery,
            headers: { 'Content-Type': 'application/json' }
        });

        const hit = data.hits?.hits?.[0];
        if (!hit || !hit._source.declarations || hit._source.declarations.length === 0) {
            console.warn("No definition source found via search API.");
            return []; // Fallback to empty
        }

        const declaration = hit._source.declarations[0];
        const rawUrl = getRawUrl(declaration.url);
        
        console.log(`Found source at: ${rawUrl}`);

        // 2. Fetch the Raw Content
        const content = await window.electronAPI.fetchExternal(rawUrl);
        if (!content) {
            throw new Error("Empty content returned from source");
        }

        // 3. Parse content
        // Prefix logic: The parser extracts keys like "enable". We need to prepend the service name
        // if the parser works purely on local keys.
        // Our parser extracts "enable" but the user expects "services.openssh.enable".
        // HOWEVER, the raw file might contain "options.services.openssh = { ... }".
        // If the parser finds nested keys correctly, we are good.
        // But our simple parser might just find keys.
        // Let's pass the service name as prefix if our parser logic in 'parseNixModuleRaw' supports it.
        // We added a 'prefix' arg to 'parseNixModuleRaw'.
        
        // NOTE: A module file often nests it like 'options.services.foo = ...'.
        // If we blindly pass prefix 'services.foo', we might end up with double prefix if parser handles nesting.
        // But our simple parser logic (looking for assignment) is likely flatter.
        // Let's try parsing without prefix first, and filter?
        // Actually, the parser I wrote takes a prefix.
        
        // Ideally we pass the service name as prefix, assuming the module defines options RELATIVE to the structure or using absolute paths.
        // In 'sshd.nix', keys are defined as 'enable = ...'. They are inside 'options.services.openssh'.
        // So they are relative keys.
        
        return parseNixModuleRaw(content, limitToService);

    } catch (e) {
        console.error("Source fetch failed, falling back to basic search.", e);
        // Fallback to standard fetch
        return fetchServiceOptions(limitToService);
    }
}
