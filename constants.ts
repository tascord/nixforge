import { AppConfig, NixService } from "./types";

export const NIX_VERSIONS = [
  { id: "nixos-unstable", label: "Unstable (Rolling)" },
  { id: "nixos-24.05", label: "24.05 (Stable)" },
  { id: "nixos-23.11", label: "23.11 (Old Stable)" },
];

export const HARDWARE_PRESETS = [
  { id: "", label: "None / Generic" },
  { id: "framework-13-7040-amd", label: "Framework 13 (AMD Ryzen 7040)" },
  { id: "framework-12th-gen-intel", label: "Framework 13 (Intel 12th Gen)" },
  { id: "framework-11th-gen-intel", label: "Framework 13 (Intel 11th Gen)" },
  { id: "lenovo-thinkpad-x1-9th-gen", label: "Lenovo ThinkPad X1 Carbon (Gen 9)" },
  { id: "lenovo-thinkpad-t14-amd-gen1", label: "Lenovo ThinkPad T14 (AMD Gen 1)" },
  { id: "dell-xps-13-9310", label: "Dell XPS 13 (9310)" },
  { id: "dell-xps-15-9500", label: "Dell XPS 15 (9500)" },
  { id: "apple-macbook-pro-14-m1", label: "Apple MacBook Pro 14 (M1/Pro/Max) - (Requires nixos-apple-silicon)" },
];

export const INITIAL_CONFIG: AppConfig = {
  nixVersion: "nixos-unstable",
  system: {
    hostname: "nixos-machine",
    timezone: "UTC",
    locale: "en_US.UTF-8",
    keyboardLayout: "us",
    experimentalFeatures: ["nix-command", "flakes"],
    bootloader: "systemd-boot",
    swapSize: 0,
    hardwareProfile: "",
    hardwareConfigContent: "",
    systemPackages: [
      { name: "vim", description: "The ubiquitous text editor" },
      { name: "git", description: "Distributed version control system" },
      { name: "wget", description: "Tool for retrieving files using HTTP, HTTPS, and FTP" },
    ],
    services: [
      { name: "services.openssh", enabled: true, options: { "settings.PasswordAuthentication": false, "settings.PermitRootLogin": "no" }, description: "Secure Shell daemon" },
    ],
  },
  users: [
    {
      username: "nixuser",
      description: "Primary User",
      shell: "pkgs.bash",
      extraGroups: ["networkmanager", "wheel"],
      packages: [],
      gitName: "",
      gitEmail: "",
    },
  ],
};

export const COMMON_GROUPS = [
  "wheel",
  "networkmanager",
  "docker",
  "audio",
  "video",
  "input",
  "libvirtd",
];

