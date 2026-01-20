// This file is JSON structure for easier parsing/extending
import { PackageGroup } from "./types";

export const PACKAGE_GROUPS: PackageGroup[] = [
    {
        id: "communication",
        name: "Communication & Social",
        description: "Stay connected with friends and colleagues",
        packages: [
            { name: "pkgs.discord", description: "All-in-one voice and text chat for gamers" },
            { name: "pkgs.slack", description: "Team communication and collaboration" },
            { name: "pkgs.telegram-desktop", description: "Desktop client for the Telegram messenger" },
            { name: "pkgs.signal-desktop", description: "Private messenger for Windows, Mac, and Linux" },
            { name: "pkgs.zoom-us", description: "Video conferencing meeting service" },
            { name: "pkgs.thunderbird", description: "Full-featured email creation and management" }
        ]
    },
    {
        id: "media",
        name: "Multimedia",
        description: "Audio, Video, and Content Creation",
        packages: [
            { name: "pkgs.spotify", description: "Music streaming service" },
            { name: "pkgs.vlc", description: "Cross-platform multimedia player" },
            { name: "pkgs.obs-studio", description: "Software for video recording and live streaming" },
            { name: "pkgs.gimp", description: "GNU Image Manipulation Program" },
            { name: "pkgs.inkscape", description: "Vector graphics editor" },
            { name: "pkgs.blender", description: "3D creation suite" },
            { name: "pkgs.audacity", description: "Sound editor and recorder" },
            { name: "pkgs.mpv", description: "Command line video player" }
        ]
    },
    {
        id: "browsers",
        name: "Web Browsers",
        description: "Explore the internet",
        packages: [
            { name: "pkgs.firefox", description: "Mozilla Firefox Web Browser" },
            { name: "pkgs.google-chrome", description: "Google Chrome Web Browser" },
            { name: "pkgs.brave", description: "Privacy-oriented browser" },
            { name: "pkgs.chromium", description: "Open source web browser project" },
            { name: "pkgs.microsoft-edge", description: "The web browser from Microsoft" }
        ]
    },
    {
        id: "development",
        name: "Development Tools",
        description: "IDE, Editors, and Compilers",
        packages: [
            { name: "pkgs.vscode", description: "Visual Studio Code" },
            { name: "pkgs.jetbrains.idea-community", description: "IntelliJ IDEA Community Edition" },
            { name: "pkgs.git", description: "Distributed version control system" },
            { name: "pkgs.nodejs", description: "Event-driven I/O server-side JavaScript environment" },
            { name: "pkgs.python3", description: "The Python programming language" },
            { name: "pkgs.go", description: "The Go programming language" },
            { name: "pkgs.rustc", description: "Compiler for the Rust programming language" },
            { name: "pkgs.cargo", description: "Downloads your Rust project's dependencies and builds your project" },
            { name: "pkgs.docker", description: "Pack, ship and run any application as a lightweight container" },
            { name: "pkgs.postman", description: "API Development Environment" }
        ]
    },
    {
        id: "gaming",
        name: "Gaming",
        description: "Play games on Linux",
        packages: [
            { name: "pkgs.steam", description: "Digital distribution platform" },
            { name: "pkgs.lutris", description: "Open Source gaming platform for Linux" },
            { name: "pkgs.heroic", description: "A Native GOG, Epic, and Amazon Games Launcher" },
            { name: "pkgs.prismlauncher", description: "Minecraft launcher" },
            { name: "pkgs.mangohud", description: "A Vulkan and OpenGL overlay for monitoring FPS, temperatures, CPU/GPU load" },
            { name: "pkgs.gamemode", description: "Optimise Linux system performance on demand" }
        ]
    },
    {
        id: "productivity",
        name: "Productivity",
        description: "Office and work tools",
        packages: [
            { name: "pkgs.libreoffice", description: "Comprehensive, professional-quality productivity suite" },
            { name: "pkgs.obsidian", description: "A powerful knowledge base that works on top of a local folder of plain text Markdown files" },
            { name: "pkgs.notion-app-enhanced", description: "Notion Desktop App" },
            { name: "pkgs.anytype", description: "Object-based note taking tool" }
        ]
    },
    {
        id: "system",
        name: "System Tools",
        description: "Utilities to manage your system",
        packages: [
            { name: "pkgs.htop", description: "Interactive process viewer" },
            { name: "pkgs.btop", description: "A monitor of resources" },
            { name: "pkgs.neofetch", description: "A command-line system information tool" },
            { name: "pkgs.gparted", description: "Graphical partition editor" },
            { name: "pkgs.ripgrep", description: "Line-oriented search tool that recursively searches the current directory" },
            { name: "pkgs.fd", description: "A simple, fast and user-friendly alternative to 'find'" },
            { name: "pkgs.bat", description: "A cat(1) clone with wings" }
        ]
    }
];
