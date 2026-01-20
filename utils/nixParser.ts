import { NixOptionMetadata } from '../types';

// Simple parser for Nix option definitions
// This parses standard "options = { ... }" blocks found in NixOS modules
// It is tolerant of formatting but relies on "lib.mkOption" or "mkEnableOption" calls.

export const parseNixModuleRaw = (content: string, prefix: string = ''): NixOptionMetadata[] => {
    const options: NixOptionMetadata[] = [];
    
    // Remove comments to verify structure safely? 
    // Nix comments are # or /* */. Keeping them might be needed for hacking regexes, 
    // but a clean stream is easier for a tokenizer.
    // Let's rely on regex matching for specific blocks for robustness against syntax errors.

    // 1. Locate the "options" block
    // This is tricky if there are multiple. We usually want the main one.
    // Simplified: Look for keys assigned to mkOption or mkEnableOption
    
    // Pattern for: key = lib.mkOption { ... };
    // This regex attempts to find the key and the start of the option block
    // logic: key (captured) followed by = (maybe namespaced) mkOption
    const mkOptionRegex = /([a-zA-Z0-9_\.]+)\s*=\s*(?:lib\.)?mkOption\s*\{/g;
    
    // Pattern for: key = lib.mkEnableOption "Description";
    const mkEnableRegex = /([a-zA-Z0-9_\.]+)\s*=\s*(?:lib\.)?mkEnableOption\s*"(.*?)";/g;

    let match;

    // Handle mkEnableOption (simple boolean)
    while ((match = mkEnableRegex.exec(content)) !== null) {
        options.push({
            name: prefix ? `${prefix}.${match[1]}` : match[1],
            description: match[2],
            type: 'boolean',
            example: 'true'
        });
    }

    // Handle mkOption (complex metadata)
    // We need to parse matching braces after the regex match
    while ((match = mkOptionRegex.exec(content)) !== null) {
        const key = match[1];
        const startIndex = match.index + match[0].length;
        const blockContent = extractBracedBlock(content, startIndex);
        
        if (blockContent) {
            options.push(parseOptionDetails(key, blockContent, prefix));
        }
    }

    return options;
};

const extractBracedBlock = (fullText: string, startIndex: number): string | null => {
    let depth = 1; // We start after the first '{'
    let index = startIndex;
    let inString = false;
    
    while (index < fullText.length && depth > 0) {
        const char = fullText[index];
        
        // Handle strings to ignore braces inside them
        if (char === '"' && fullText[index - 1] !== '\\') {
            inString = !inString;
        }

        if (!inString) {
            if (char === '{') depth++;
            if (char === '}') depth--;
        }
        index++;
    }

    if (depth === 0) {
        // Return content inside braces
        return fullText.substring(startIndex, index - 1);
    }
    return null;
};

const parseOptionDetails = (key: string, block: string, prefix: string): NixOptionMetadata => {
    // Basic extraction regexes
    // Valid for "type = ...;"
    const typeMatch = block.match(/type\s*=\s*([^;]+);/);
    // Valid for "default = ...;" - naive, fails on multi-line defaults
    const defaultMatch = block.match(/default\s*=\s*([^;]+);/);
    
    // Description can be multi-line '' string or single line " string
    let description = '';
    const descMatchMulti = block.match(/description\s*=\s*''([\s\S]*?)'';/);
    const descMatchSingle = block.match(/description\s*=\s*"(.*?)";/);
    
    if (descMatchMulti) description = descMatchMulti[1].trim();
    else if (descMatchSingle) description = descMatchSingle[1].trim();

    // Example
    const exampleMatch = block.match(/example\s*=\s*([^;]+);/);

    // Clean up Type
    let type = 'other';
    const rawType = typeMatch?.[1] || '';
    if (rawType.includes('bool')) type = 'boolean';
    else if (rawType.includes('str') || rawType.includes('lines')) type = 'string';
    else if (rawType.includes('int') || rawType.includes('port')) type = 'int';
    else if (rawType.includes('list')) type = 'list';

    // Construct full name
    const fullName = prefix ? `${prefix}.${key}` : key;
    
    // Handle specific hardcoded "services.openssh.enable" mapping if usually nested
    // (But the parser is generic).

    return {
        name: fullName,
        description: description,
        type: type as any,
        example: exampleMatch ? exampleMatch[1].trim() : (defaultMatch ? defaultMatch[1].trim() : '')
    };
};
