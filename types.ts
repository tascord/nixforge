export interface NixPackage {
  name: string;
  description: string;
  category?: string;
}

export type NixValue = string | boolean | number | string[];

export interface NixOptionMetadata {
  name: string;
  description: string;
  type: 'boolean' | 'string' | 'int' | 'list' | 'other';
  example: string;
}

export interface NixService {
  name: string;
  enabled: boolean;
  options: Record<string, NixValue>;
  description?: string;
  knownOptions?: NixOptionMetadata[]; // Cache for discovered options
}

export interface UserConfig {
  username: string;
  description: string;
  extraGroups: string[];
  shell: string;
  packages: NixPackage[];
  gitName?: string;
  gitEmail?: string;
  hashedPassword?: string;
}

export interface SystemConfig {
  hostname: string;
  timezone: string;
  locale: string;
  keyboardLayout: string;
  experimentalFeatures: string[];
  bootloader: 'systemd-boot' | 'grub';
  swapSize: number; // in GB
  hardwareProfile: string; // e.g. "framework-13-7040-amd"
  hardwareConfigContent?: string; // Raw content of hardware-configuration.nix
  systemPackages: NixPackage[];
  services: NixService[];
}

export interface AppConfig {
  nixVersion: string; // e.g., "nixos-unstable", "23.11"
  flakeInputs?: { name: string; url: string; packages?: string[] }[];
  system: SystemConfig;
  users: UserConfig[];
}

export interface ElectronAPI {
  saveFile: (content: string, filename: string) => Promise<{ success: boolean; filePath?: string; canceled?: boolean }>;
  selectDirectory: () => Promise<{ success: boolean; path?: string; canceled?: boolean }>;
  writeFile: (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>;
  fetchExternal: (url: string, options?: any) => Promise<any>;
  readFile: (filePath: string) => Promise<{ success: boolean; content?: string; error?: string }>;
  checkFileExists: (filePath: string) => Promise<{ exists: boolean }>;
  openFolder: (path: string) => Promise<{ success: boolean; error?: string }>;
  getAppPaths: () => Promise<{ home: string; documents: string; userData: string }>;
  generateHardwareConfig: () => Promise<{ success: boolean; content?: string; error?: string }>;
  generatePasswordHash: (password: string) => Promise<{ success: boolean; hash?: string; error?: string }>;
  runBuild: (args: { directory: string; action: 'switch' | 'boot'; flakeURI: string }) => void;
  onBuildLog: (callback: (log: string) => void) => void;
  onBuildExit: (callback: (code: number) => void) => void;
  saveConfig: (config: AppConfig) => Promise<{ success: boolean; error?: string }>;
  loadConfig: () => Promise<{ success: boolean; config?: AppConfig; error?: string }>;
  searchPackages: (query: string) => Promise<{ success: boolean; packages?: NixPackage[]; error?: string }>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export interface GeneratedFile {
  name: string;
  content: string;
  language: 'nix';
}

export enum Tab {
  GENERAL = 'General',
  HARDWARE = 'Hardware',
  PACKAGES = 'Packages',
  SERVICES = 'Services',
  USERS = 'Users',
  CODE = 'Code'
}

export interface PackageGroup {
  id: string;
  name: string;
  description: string;
  packages: { name: string; description: string }[];
}
