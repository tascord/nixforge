import { NixPackage, NixService } from "./types";

export interface Bundle {
  id: string;
  name: string;
  description: string;
  icon: string;
  packages: NixPackage[];
  services: NixService[];
}

export const BUNDLES: Bundle[] = [
  {
    id: "system-basics-gnome",
    name: "System Basics (GNOME)",
    description: "Essential packages and services for a GNOME desktop environment including networking, fonts, and basic utilities",
    icon: "monitor",
    packages: [
      { name: "pkgs.networkmanager", description: "Network configuration and management" },
      { name: "pkgs.networkmanagerapplet", description: "NetworkManager applet for system tray" },
      { name: "pkgs.wget", description: "Tool for retrieving files using HTTP, HTTPS, and FTP" },
      { name: "pkgs.curl", description: "Command line tool for transferring data with URLs" },
      { name: "pkgs.firefox", description: "Mozilla Firefox Web Browser" },
      { name: "pkgs.gnome-tweaks", description: "Customize advanced GNOME 3 options" },
      { name: "pkgs.gnome-themes-extra", description: "Extra themes for GNOME" },
      { name: "pkgs.gsettings-desktop-schemas", description: "GSettings schemas for desktop components" },
    ],
    services: [
      { name: "services.xserver.enable", enabled: true, options: {}, description: "X11 windowing system" },
      { name: "services.desktopManager.gnome.enable", enabled: true, options: {}, description: "GNOME Desktop Environment" },
      { name: "services.displayManager.gdm.enable", enabled: true, options: {}, description: "GNOME Display Manager" },
      { name: "networking.networkmanager.enable", enabled: true, options: {}, description: "NetworkManager for network configuration" },
    ],
  },
  {
    id: "system-basics-plasma",
    name: "System Basics (Plasma)",
    description: "Essential packages and services for a KDE Plasma desktop environment including networking, fonts, and basic utilities",
    icon: "monitor",
    packages: [
      { name: "pkgs.networkmanager", description: "Network configuration and management" },
      { name: "pkgs.wget", description: "Tool for retrieving files using HTTP, HTTPS, and FTP" },
      { name: "pkgs.curl", description: "Command line tool for transferring data with URLs" },
      { name: "pkgs.firefox", description: "Mozilla Firefox Web Browser" },
      { name: "pkgs.kate", description: "Advanced text editor for KDE" },
      { name: "pkgs.kcalc", description: "Scientific calculator for KDE" },
      { name: "pkgs.konsole", description: "Terminal emulator for KDE" },
    ],
    services: [
      { name: "services.xserver.enable", enabled: true, options: {}, description: "X11 windowing system" },
      { name: "services.desktopManager.plasma6.enable", enabled: true, options: {}, description: "KDE Plasma 6 Desktop Environment" },
      { name: "services.displayManager.sddm.enable", enabled: true, options: {}, description: "Simple Desktop Display Manager" },
      { name: "networking.networkmanager.enable", enabled: true, options: {}, description: "NetworkManager for network configuration" },
    ],
  },
  {
    id: "gaming-setup",
    name: "Gaming Setup",
    description: "Complete gaming environment with Steam, game launchers, and performance optimization tools",
    icon: "gamepad",
    packages: [
      { name: "pkgs.steam", description: "Digital distribution platform" },
      { name: "pkgs.lutris", description: "Open Source gaming platform for Linux" },
      { name: "pkgs.heroic", description: "A Native GOG, Epic, and Amazon Games Launcher" },
      { name: "pkgs.prismlauncher", description: "Minecraft launcher" },
      { name: "pkgs.mangohud", description: "A Vulkan and OpenGL overlay for monitoring FPS, temperatures, CPU/GPU load" },
      { name: "pkgs.gamemode", description: "Optimise Linux system performance on demand" },
      { name: "pkgs.discord", description: "All-in-one voice and text chat for gamers" },
    ],
    services: [
      { name: "programs.steam.enable", enabled: true, options: {}, description: "Steam gaming platform" },
      { name: "programs.gamemode.enable", enabled: true, options: {}, description: "Optimize system performance for games" },
    ],
  },
  {
    id: "productivity-suite",
    name: "Productivity Suite",
    description: "Office applications, note-taking tools, and collaboration software for getting work done",
    icon: "briefcase",
    packages: [
      { name: "pkgs.libreoffice", description: "Comprehensive, professional-quality productivity suite" },
      { name: "pkgs.obsidian", description: "A powerful knowledge base that works on top of a local folder of plain text Markdown files" },
      { name: "pkgs.thunderbird", description: "Full-featured email creation and management" },
      { name: "pkgs.slack", description: "Team communication and collaboration" },
      { name: "pkgs.zoom-us", description: "Video conferencing meeting service" },
      { name: "pkgs.gimp", description: "GNU Image Manipulation Program" },
      { name: "pkgs.inkscape", description: "Vector graphics editor" },
    ],
    services: [],
  },
  {
    id: "development-environment",
    name: "Development Environment",
    description: "Essential development tools, editors, version control, and programming languages",
    icon: "code",
    packages: [
      { name: "pkgs.vscode", description: "Visual Studio Code" },
      { name: "pkgs.git", description: "Distributed version control system" },
      { name: "pkgs.nodejs", description: "Event-driven I/O server-side JavaScript environment" },
      { name: "pkgs.python3", description: "The Python programming language" },
      { name: "pkgs.go", description: "The Go programming language" },
      { name: "pkgs.rustc", description: "Compiler for the Rust programming language" },
      { name: "pkgs.cargo", description: "Downloads your Rust project's dependencies and builds your project" },
      { name: "pkgs.docker", description: "Pack, ship and run any application as a lightweight container" },
      { name: "pkgs.docker-compose", description: "Multi-container orchestration for Docker" },
    ],
    services: [
      { name: "virtualisation.docker.enable", enabled: true, options: {}, description: "Docker container runtime" },
    ],
  },
];
