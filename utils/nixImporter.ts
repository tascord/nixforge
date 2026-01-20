import { AppConfig, SystemConfig, NixPackage } from '../types';

const HEADER = "# --- BEGIN NIXFORGE GENERATED ---";
const FOOTER = "# --- END NIXFORGE GENERATED ---";

const extractGeneratedBlock = (content: string): string => {
    const startIndex = content.indexOf(HEADER);
    const endIndex = content.indexOf(FOOTER);

    if (startIndex !== -1 && endIndex !== -1) {
        // Return content between Header and Footer
        // Add length of header to start index to skip it
        return content.substring(startIndex + HEADER.length, endIndex);
    }
    
    // Fallback: If no tags found, return nothing or return everything?
    // If we return everything, we might overwrite manual changes elsewhere if we are not careful.
    // The instructions say "Read everything between the marker tags". 
    // This implies we should IGNORE anything outside.
    // However, if the file is completely manual (no tags), maybe we should try to parse it?
    // For now, let's respect the user's intent: ONLY read between tags if tags exist.
    // If tags don't exist, we might be importing a legacy file. Let's return full content for that case.
    if (startIndex === -1 && endIndex === -1) {
        return content;
    }

    return "";
};

const PACKAGE_RENAMES: Record<string, string> = {
  'noto-fonts-cjk': 'noto-fonts-cjk-sans',
  'pkgs.noto-fonts-cjk': 'noto-fonts-cjk-sans',
  'noto-fonts-emoji': 'noto-fonts-color-emoji',
  'pkgs.noto-fonts-emoji': 'noto-fonts-color-emoji',
  'nerdfonts': 'nerd-fonts.symbols-only',
  'pkgs.nerdfonts': 'nerd-fonts.symbols-only',
  'nerd-fonts': 'nerd-fonts.symbols-only',
  'pkgs.nerd-fonts': 'nerd-fonts.symbols-only',
};

export const parseExistingConfig = (content: string, currentConfig: AppConfig): AppConfig => {
  const block = extractGeneratedBlock(content);
  if (!block) return currentConfig;
  
  const lines = block.split('\n');
  // Deep copy to avoid mutating the original
  const newConfig = JSON.parse(JSON.stringify(currentConfig)) as AppConfig;
  
  let inSystemPackages = false;
  let currentUser: string | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('/*')) continue;

    // Remove trailing semicolons for easier matching
    const cleanLine = trimmed.replace(/;$/, '');

    // Hostname
    if (cleanLine.startsWith('networking.hostName')) {
      const match = cleanLine.match(/networking\.hostName\s*=\s*"(.*)"/);
      if (match) newConfig.system.hostname = match[1];
    }

    // Timezone
    else if (cleanLine.startsWith('time.timeZone')) {
       const match = cleanLine.match(/time\.timeZone\s*=\s*"(.*)"/);
       if (match) newConfig.system.timezone = match[1];
    }

    // Locale
    else if (cleanLine.startsWith('i18n.defaultLocale')) {
       const match = cleanLine.match(/i18n\.defaultLocale\s*=\s*"(.*)"/);
       if (match) newConfig.system.locale = match[1];
    }

    // Keyboard Layout
    else if (cleanLine.startsWith('services.xserver.xkb.layout') || cleanLine.startsWith('services.xserver.layout')) {
        const match = cleanLine.match(/layout\s*=\s*"(.*)"/);
        if (match) newConfig.system.keyboardLayout = match[1];
    }

    // Hardware Profile
    else if (cleanLine.includes('inputs.nixos-hardware.nixosModules.')) {
        const match = cleanLine.match(/inputs\.nixos-hardware\.nixosModules\.([a-zA-Z0-9-]+)/);
        if (match) newConfig.system.hardwareProfile = match[1];
    }

    // Experimental Features
    else if (cleanLine.startsWith('nix.settings.experimental-features')) {
        const match = cleanLine.match(/\[\s*(.*)\s*\]/);
        if (match) {
            newConfig.system.experimentalFeatures = match[1].split(/\s+/).map(f => f.replace(/"/g, '')).filter(Boolean);
        }
    }

    // Swap Size
    else if (cleanLine.startsWith('size = ')) {
        const match = cleanLine.match(/size\s*=\s*([0-9]+)/);
        if (match) {
            // Only update if it looks like a swap size (multiple of 1024 or just large)
            const sizeVal = parseInt(match[1]);
            if (sizeVal >= 1024) {
                newConfig.system.swapSize = Math.round(sizeVal / 1024);
            }
        }
    }

    // Bool properties
    else if (cleanLine.includes(' = true')) {
        // ... (rest is same)
        // Try to identify services enabled
        // e.g. services.openssh.enable = true;
        const parts = cleanLine.split(' = ');
        if (parts.length === 2 && parts[1].trim() === 'true') {
            const key = parts[0];
            if (key.startsWith('services.')) {
                 const serviceName = key.replace('.enable', '').trim();
                 // Add to services if not present
                 if (!newConfig.system.services.find(s => s.name === serviceName)) {
                     newConfig.system.services.push({
                         name: serviceName,
                         enabled: true,
                         options: {}
                     });
                 }
            } else if (key === 'boot.loader.systemd-boot.enable') {
                newConfig.system.bootloader = 'systemd-boot';
            } else if (key === 'boot.loader.grub.enable') {
                newConfig.system.bootloader = 'grub';
            }
        }
    }

    // System Packages (Simple implementation)
    // Supports: environment.systemPackages = with pkgs; [ val1 val2 ... ];
    if (cleanLine.startsWith('environment.systemPackages')) {
        inSystemPackages = true;
        continue;
    }

    if (inSystemPackages) {
        if (trimmed.includes('];')) {
            inSystemPackages = false;
        } else {
             // Treat words as packages
             const packages = trimmed.split(/\s+/).filter(p => p && !p.startsWith('#'));
             packages.forEach(pkgName => {
                 const cleanPkgName = pkgName.replace(/^pkgs\./, "");
                 const renamedPkgName = PACKAGE_RENAMES[cleanPkgName] || cleanPkgName;
                 const finalPkgName = pkgName.startsWith('pkgs.') ? `pkgs.${renamedPkgName}` : renamedPkgName;

                 if (!newConfig.system.systemPackages.find(p => p.name === finalPkgName)) {
                     newConfig.system.systemPackages.push({
                         name: finalPkgName,
                         description: 'Imported package',
                     });
                 }
             });
        }
    }

    // User Configuration
    if (cleanLine.startsWith('users.users.')) {
        const match = cleanLine.match(/users\.users\.([a-zA-Z0-9_]+)\s*=\s*{/);
        if (match) {
            currentUser = match[1];
            // If the user name is "nixuser" (the default), and we find another username in the file,
            // we should probably replace "nixuser" instead of appending?
            // Actually, let's just make sure we don't have duplicates.
            const existingUserIndex = newConfig.users.findIndex(u => u.username === currentUser);
            
            if (existingUserIndex === -1) {
                // If we only have one user and it's the default "nixuser", rename it instead of adding
                if (newConfig.users.length === 1 && newConfig.users[0].username === 'nixuser') {
                    newConfig.users[0].username = currentUser;
                    newConfig.users[0].description = currentUser;
                } else {
                    newConfig.users.push({
                        username: currentUser,
                        description: currentUser,
                        extraGroups: [],
                        shell: 'pkgs.bash',
                        packages: []
                    });
                }
            }
        }
    }

    if (currentUser) {
        if (cleanLine.startsWith('description')) {
             const match = cleanLine.match(/description\s*=\s*"(.*)"/);
             if (match) {
                 const u = newConfig.users.find(users => users.username === currentUser);
                 if (u) u.description = match[1];
             }
        }
        else if (cleanLine.startsWith('initialPassword') || cleanLine.startsWith('hashedPassword')) {
             const matchInitial = cleanLine.match(/initialPassword\s*=\s*"(.*)"/);
             const matchHashed = cleanLine.match(/hashedPassword\s*=\s*"(.*)"/);
             const match = matchInitial || matchHashed;
             if (match) {
                 const u = newConfig.users.find(users => users.username === currentUser);
                 if (u) u.hashedPassword = match[1];
             }
        }
        else if (cleanLine.startsWith('extraGroups')) {
             const match = cleanLine.match(/extraGroups\s*=\s*\[\s*(.*)\s*\]/);
             if (match) {
                 const groups = match[1].split(/\s+/).map(g => g.replace(/"/g, '')).filter(Boolean);
                 const u = newConfig.users.find(users => users.username === currentUser);
                 if (u) u.extraGroups = groups;
             }
        }
        else if (cleanLine.startsWith('shell')) {
             const match = cleanLine.match(/shell\s*=\s*(.*)/);
             if (match) {
                 const u = newConfig.users.find(users => users.username === currentUser);
                 if (u) u.shell = match[1].trim();
             }
        }
        else if (cleanLine === '}') {
            currentUser = null;
        }
    }
  }

  return newConfig;
};

export const parseFlakeConfig = (content: string, currentConfig: AppConfig): AppConfig => {
    const block = extractGeneratedBlock(content);
    if (!block) return currentConfig;

    const newConfig = JSON.parse(JSON.stringify(currentConfig)) as AppConfig;
    newConfig.flakeInputs = []; // Reset to avoid duplicates
    
    const lines = block.split('\n');
    for (const line of lines) {
        const cleanLine = line.trim().replace(/;$/, '');
        
        // Parse inputs: name.url = "url"
        const urlMatch = cleanLine.match(/^([a-zA-Z0-9_-]+)\.url\s*=\s*"(.*)"/);
        
        if (urlMatch) {
            const name = urlMatch[1];
            const url = urlMatch[2];
            
            if (name === 'nixpkgs') {
                // Parse nixpkgs url for version
                // github:nixos/nixpkgs/nixos-unstable
                const parts = url.split('/');
                if (parts.length > 0) {
                     let branch = parts[parts.length - 1];
                     // Map back from release-XX.YY to nixos-XX.YY
                     if (branch.startsWith('release-')) {
                         branch = 'nixos-' + branch.substring(8);
                     }
                     newConfig.nixVersion = branch;
                }
            } else if (name !== 'home-manager' && name !== 'nixos-hardware') {
                // Add custom input
                newConfig.flakeInputs.push({ name, url });
            }
        }
    }

    return newConfig;
};

export const parseHomeConfig = (content: string, currentConfig: AppConfig, userIndex: number = 0): AppConfig => {
    const block = extractGeneratedBlock(content);
    if (!block) return currentConfig;
    
    const lines = block.split('\n');
    // Deep copy
    const newConfig = JSON.parse(JSON.stringify(currentConfig)) as AppConfig;
    if (!newConfig.users[userIndex]) return newConfig;
    
    const newUser = newConfig.users[userIndex];
    let inHomePackages = false;

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('/*')) continue;
        const cleanLine = trimmed.replace(/;$/, '');

        // Git Configuration
        if (cleanLine.startsWith('programs.git.userName')) {
            const match = cleanLine.match(/userName\s*=\s*"(.*)"/);
            if (match) newUser.gitName = match[1];
        }
        else if (cleanLine.startsWith('programs.git.userEmail')) {
            const match = cleanLine.match(/userEmail\s*=\s*"(.*)"/);
            if (match) newUser.gitEmail = match[1];
        }

        // Shell
        else if (cleanLine.match(/^programs\.bash\.enable\s*=\s*true/)) {
            newUser.shell = 'pkgs.bash';
        }
        else if (cleanLine.match(/^programs\.fish\.enable\s*=\s*true/)) {
            newUser.shell = 'pkgs.fish';
        }
        else if (cleanLine.match(/^programs\.zsh\.enable\s*=\s*true/)) {
            newUser.shell = 'pkgs.zsh';
        }

        // Home Packages
        if (cleanLine.startsWith('home.packages')) {
            inHomePackages = true;
            continue;
        }

        if (inHomePackages) {
            if (trimmed.includes('];')) {
                inHomePackages = false;
            } else {
                const packages = trimmed.split(/\s+/).filter(p => p && !p.startsWith('#') && p !== 'with' && p !== 'pkgs;');
                 packages.forEach(pkgName => {
                     // Clean up simple "pkgs." prefix
                     const cleanName = pkgName.replace(/^pkgs\./, '');
                     const renamedName = PACKAGE_RENAMES[cleanName] || cleanName;
                     
                     if (!newUser.packages.find(p => p.name === renamedName)) {
                         newUser.packages.push({
                             name: renamedName,
                             description: 'Imported user package',
                         });
                     }
                 });
            }
        }
    }

    newConfig.users[userIndex] = newUser;
    return newConfig;
};
