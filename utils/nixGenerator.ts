import { AppConfig, SystemConfig, UserConfig, NixValue } from "../types";

const HEADER = "# --- BEGIN NIXFORGE GENERATED ---\n# This section is managed by NixForge. Manual changes may be overwritten if tags are respected.\n";
const FOOTER = "\n# --- END NIXFORGE GENERATED ---\n";

const SERVICE_RENAMES: Record<string, string> = {
  'services.xserver.desktopManager.gnome': 'services.desktopManager.gnome',
  'services.xserver.displayManager.gdm': 'services.displayManager.gdm',
  'services.xserver.desktopManager.plasma5': 'services.desktopManager.plasma5',
  'services.xserver.displayManager.sddm': 'services.displayManager.sddm',
  'services.xserver.desktopManager.plasma6': 'services.desktopManager.plasma6',
};

const OPTION_RENAMES: Record<string, string> = {
  'services.xserver.layout': 'services.xserver.xkb.layout',
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

// Map Nix version IDs to proper nixpkgs branch names
const getNixpkgsBranch = (version: string): string => {
  const versionMap: Record<string, string> = {
    'nixos-unstable': 'nixos-unstable',
    'unstable': 'nixos-unstable',
    'nixos-24.05': 'release-24.05',
    '24.05': 'release-24.05',
    'nixos-23.11': 'release-23.11',
    '23.11': 'release-23.11',
    'nixos-24.11': 'release-24.11',
    '24.11': 'release-24.11',
  };
  return versionMap[version] || version;
};

// Home-manager uses different branch naming: 'master' for unstable, 'release-XX.YY' for releases
const getHomeManagerBranch = (version: string): string => {
  const branch = getNixpkgsBranch(version);
  // home-manager uses 'master' for unstable instead of 'nixos-unstable'
  if (branch === 'nixos-unstable') {
    return 'master';
  }
  return branch;
};

const formatValue = (value: NixValue): string => {
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return value.toString();
  if (Array.isArray(value)) return `[ ${value.map(v => `"${v}"`).join(" ")} ]`;
  // Simple string escaping for Nix
  return `"${value.toString().replace(/"/g, '\\"')}"`;
};

export const generateFlake = (config: AppConfig): string => {
  const hardwareInput = config.system.hardwareProfile 
    ? `\n    nixos-hardware.url = "github:NixOS/nixos-hardware/master";` 
    : "";

  const nixpkgsBranch = getNixpkgsBranch(config.nixVersion);
  const homeManagerBranch = getHomeManagerBranch(config.nixVersion);
  const nixpkgsUrl = `github:nixos/nixpkgs/${nixpkgsBranch}`;

  const customInputs = (config.flakeInputs || []).map(input => 
    `    ${input.name}.url = "${input.url}";\n    ${input.name}.inputs.nixpkgs.follows = "nixpkgs";`
  ).join('\n');
  const customInputsStr = customInputs ? `\n${customInputs}` : '';

  return `{
  description = "NixOS Configuration for ${config.system.hostname}";

  inputs = {
${HEADER}    nixpkgs.url = "${nixpkgsUrl}";
    #nixforge.url = "github:tascord/nixforge";
    #nixforge.inputs.nixpkgs.follows = "nixpkgs";
    home-manager.url = "github:nix-community/home-manager/${homeManagerBranch}";
    home-manager.inputs.nixpkgs.follows = "nixpkgs";${hardwareInput}${customInputsStr}${FOOTER}
  };

  outputs = { self, nixpkgs, home-manager, ... }@inputs: {
    nixosConfigurations.${config.system.hostname} = nixpkgs.lib.nixosSystem {
      system = "x86_64-linux";
      specialArgs = { inherit inputs; };
      modules = [
        ./configuration.nix
        home-manager.nixosModules.home-manager
        {
          home-manager.useGlobalPkgs = true;
          home-manager.useUserPackages = true;
          home-manager.backupFileExtension = "backup";
          home-manager.users.${config.users[0]?.username || "user"} = import ./home.nix;
        }
      ];
    };
  };
}
`;
};

export const generateSystemConfig = (appConfig: AppConfig): string => {
  const { system: config, users, nixVersion } = appConfig;
  const features = config.experimentalFeatures.map(f => `"${f}"`).join(" ");
  const sysPackages = config.systemPackages
    .map(p => {
        const name = p.name.replace(/^pkgs\./, "");
        return PACKAGE_RENAMES[name] || name;
    })
    .join("\n    ");
  
  const hardwareImport = config.hardwareProfile 
    ? `inputs.nixos-hardware.nixosModules.${config.hardwareProfile}`
    : "";

  const swapConfig = config.swapSize > 0 
    ? `
  swapDevices = [ {
    device = "/var/lib/swapfile";
    size = ${config.swapSize * 1024};
  } ];` 
    : "";

  const serviceConfig = config.services
    .filter(s => s.enabled)
    .map(s => {
      const name = SERVICE_RENAMES[s.name] || s.name;
      const optionKeys = Object.keys(s.options);
      if (optionKeys.length === 0) {
        return `  ${name}.enable = true;`;
      }
      const optionLines = optionKeys.map(k => `    ${k} = ${formatValue(s.options[k])};`).join("\n");
      return `  ${name} = {\n    enable = true;\n${optionLines}\n  };`;
    })
    .join("\n");

  // Deduplicate users by username to prevent "already defined" errors
  const uniqueUsers = users.filter((u, index, self) => 
    index === self.findIndex((t) => t.username === u.username)
  );

  const userConfig = uniqueUsers.map(user => `
  users.users.${user.username} = {
    isNormalUser = true;
    description = "${user.description}";
    extraGroups = [ ${user.extraGroups.map(g => `"${g}"`).join(" ")} ];
    shell = ${user.shell};
    ${user.hashedPassword ? `hashedPassword = "${user.hashedPassword}";` : ""}
  };
  `).join("\n");

  // Extract shells to enable them globally (required for Fish, Zsh, etc.)
  const shellsToEnable = Array.from(new Set(
    uniqueUsers.map(u => {
        const parts = u.shell.split('.');
        const lastPart = parts[parts.length - 1];
        return lastPart.includes('/') ? lastPart.split('/').pop() : lastPart;
    })
      .filter(s => s && s !== 'bash' && s !== 'sh')
  ));

  const importsList = [
      "./hardware-configuration.nix",
      hardwareImport
  ].filter(Boolean).join("\n      ");

  return `{ config, pkgs, inputs, ... }:

{
${HEADER}
  imports =
    [
      ${importsList}
    ];

  # Bootloader
  ${config.bootloader === 'systemd-boot' ? 'boot.loader.systemd-boot.enable = true;' : 'boot.loader.grub.enable = true;\n  boot.loader.grub.device = "/dev/sda";'}
  boot.loader.efi.canTouchEfiVariables = true;

  networking.hostName = "${config.hostname}";
  
  time.timeZone = "${config.timezone}";

  i18n.defaultLocale = "${config.locale}";

  # Keyboard layout configuration
  services.xserver.xkb.layout = "${config.keyboardLayout}";

  # Enable graphics and performance optimizations
  hardware.graphics.enable = true;
  # For older versions (pre-24.05)
  hardware.opengl.enable = true;

  # Recommended for sluggish systems/virtualization
  services.xserver.videoDrivers = [ "modesetting" ];

  nix.settings.experimental-features = [ ${features} ];
  nix.settings.auto-optimise-store = true;
  nixpkgs.config.allowUnfree = true;
  users.mutableUsers = false;
  ${swapConfig}

  ${userConfig}

  ${shellsToEnable.map(s => `programs.${s}.enable = true;`).join("\n  ")}

  environment.systemPackages = with pkgs; [
    # Essentials for GNOME and UI
    adwaita-icon-theme
    gnome-themes-extra
    hicolor-icon-theme
    #inputs.nixforge.packages.\${pkgs.system}.default
    
    ${sysPackages}
  ];

${serviceConfig}
${FOOTER}
  # Edit this file to add custom options not managed by NixForge
  system.stateVersion = "${nixVersion.includes('24.11') ? '24.11' : (nixVersion.includes('24.05') ? '24.05' : '23.11')}"; 
}
`;
};

export const mergeWithExisting = (existing: string, generated: string): string => {
  // Try to find the content between markers in the generated file
  const genStart = generated.indexOf(HEADER);
  const genEnd = generated.indexOf(FOOTER);
  
  if (genStart === -1 || genEnd === -1) {
      // Generated content is malformed? fallback to just returning it
      return generated;
  }
  
  const managedContent = generated.substring(genStart, genEnd + FOOTER.length);
  
  // Try to find markers in existing file
  const extStart = existing.indexOf(HEADER);
  const extEnd = existing.indexOf(FOOTER);
  
  if (extStart !== -1 && extEnd !== -1) {
      // Before replacing, we need to remove duplicate user definitions from the existing file
      // that are within the managed section, to prevent "already defined" errors
      let existingBeforeManaged = existing.substring(0, extStart);
      const existingAfterManaged = existing.substring(extEnd + FOOTER.length);
      
      // Extract usernames from the generated config by looking for "users.users.USERNAME = {"
      const userMatches = managedContent.match(/users\.users\.(\w+)\s*=/g) || [];
      const generatedUsernames = userMatches.map(m => m.match(/users\.users\.(\w+)/)?.[1]).filter(Boolean) as string[];
      
      // Remove user blocks from the "before" section
      for (const username of generatedUsernames) {
        // More robust regex to match multi-line user blocks
        // It looks for users.users.NAME = { ... }; and handles nested braces by matching until a line starts with }; or similar
        const userBlockRegex = new RegExp(
          `^\\s*users\\.users\\.${username}\\s*=\\s*\\{[\\s\\S]*?\\};\\s*$`,
          'gm'
        );
        existingBeforeManaged = existingBeforeManaged.replace(userBlockRegex, '');
      }
      
      // Also clean up any trailing blank lines from the removal
      existingBeforeManaged = existingBeforeManaged.replace(/\n\s*\n\s*\n/g, '\n\n');
      
      // Replace the managed block in existing file
      return existingBeforeManaged + managedContent + existingAfterManaged;
  } else {
      // Markers not found in existing file. 
      // It might be a file we haven't managed before.
      // We can't safely inject without risking breaking syntax.
      // But we can try to be smart or just overwrite?
      // Since we want to preserve "code not inside our headers", and the user implies
      // they might have added code *outside*, but if there are no headers, we can't know boundaries.
      // Safest bet for "no headers found": append user content? or just return generated (overwrite)?
      // For now, let's assume if no headers, we overwrite (fresh Install scenario usually).
      return generated;
  }
};

export const generateHomeConfig = (user: UserConfig, nixVersion: string = "23.11"): string => {
  const packages = user.packages
    .map(p => {
        const name = p.name.replace(/^pkgs\./, "");
        return PACKAGE_RENAMES[name] || name;
    })
    .join("\n    ");
  
  const gitConfig = (user.gitName || user.gitEmail) ? `
  programs.git = {
    enable = true;
    ${user.gitName ? `userName = "${user.gitName}";` : ""}
    ${user.gitEmail ? `userEmail = "${user.gitEmail}";` : ""}
  };` : `
  programs.git.enable = true;`;

  const stateVersion = nixVersion.includes('24.11') ? '24.11' : (nixVersion.includes('24.05') ? '24.05' : '23.11');

  return `{ config, pkgs, ... }:

{
${HEADER}
  home.username = "${user.username}";
  home.homeDirectory = "/home/${user.username}";

  home.packages = with pkgs; [
    ${packages}
  ];

  # Fix for missing cursor in GNOME
  home.pointerCursor = {
    gtk.enable = true;
    x11.enable = true;
    package = pkgs.adwaita-icon-theme;
    name = "Adwaita";
    size = 24;
  };

  dconf.enable = true;
  dconf.settings = {
    "org/gnome/desktop/interface" = {
      cursor-theme = "Adwaita";
    };
  };

  ${gitConfig}
  
  # Basic shell config
  programs.${(() => {
    const parts = user.shell.split('.');
    const lastPart = parts[parts.length - 1];
    return (lastPart.includes('/') ? lastPart.split('/').pop() : lastPart) || 'bash';
  })()}.enable = true;
${FOOTER}

  home.stateVersion = "${stateVersion}";
}
`;
};
