{
  description = "NixForge Electron App";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            nodejs
            electron
            python3
            pkg-config
          ];

          shellHook = ''
             export LD_LIBRARY_PATH=${pkgs.lib.makeLibraryPath [
               pkgs.stdenv.cc.cc.lib
               pkgs.libz
               pkgs.glib
               pkgs.gtk3
               pkgs.nss
               pkgs.nspr
               pkgs.alsa-lib
               pkgs.cups
               pkgs.dbus
               pkgs.expat
               pkgs.systemd
               pkgs.libdrm
               pkgs.mesa
               pkgs.libxkbcommon
               pkgs.pango
               pkgs.cairo
               pkgs.gdk-pixbuf
               pkgs.libuuid
               pkgs.at-spi2-atk
               pkgs.at-spi2-core
               pkgs.libappindicator-gtk3
               pkgs.libxshmfence
               pkgs.libGL
               pkgs.libglvnd
               pkgs.pciutils
               pkgs.xorg.libX11
               pkgs.xorg.libXcomposite
               pkgs.xorg.libXdamage
               pkgs.xorg.libXext
               pkgs.xorg.libXfixes
               pkgs.xorg.libXrandr
               pkgs.xorg.libxcb
               pkgs.xorg.libXcursor
               pkgs.xorg.libXi
               pkgs.xorg.libXrender
               pkgs.xorg.libXScrnSaver
               pkgs.xorg.libXtst
             ]}:$LD_LIBRARY_PATH
             
             export ELECTRON_OVERRIDE_DIST_PATH=${pkgs.electron}/bin
             
             export XDG_DATA_DIRS="${pkgs.gsettings-desktop-schemas}/share/gsettings-schemas/${pkgs.gsettings-desktop-schemas.name}:${pkgs.gtk3}/share/gsettings-schemas/${pkgs.gtk3.name}:$XDG_DATA_DIRS"

             # Fix for electron opening failed on some systems
             # export ELECTRON_OZONE_PLATFORM_HINT=wayland 
          '';
        };

        packages.default = pkgs.buildNpmPackage {
          pname = "nixforge";
          version = "0.0.0";
          src = ./.;

          npmDepsHash = "sha256-4rDJlmj8scC/U1uAVhvItxeaxJdQcLknu0fnnhfl8aY=";

          nativeBuildInputs = [ pkgs.python3 pkgs.pkg-config pkgs.makeWrapper ];

          ELECTRON_SKIP_BINARY_DOWNLOAD = "1";
          
          # Electron needs to be available at runtime
          buildPhase = ''
            npm exec vite build
            npm exec tsc
          '';
          
          installPhase = ''
            mkdir -p $out/lib/nixforge
            cp -r . $out/lib/nixforge
            
            mkdir -p $out/bin
            makeWrapper ${pkgs.electron}/bin/electron $out/bin/nixforge \
              --add-flags "$out/lib/nixforge/dist-electron/main.js" \
              --set ELECTRON_OVERRIDE_DIST_PATH "${pkgs.electron}/bin"

            mkdir -p $out/share/applications
            cp nixforge.desktop $out/share/applications/
          '';
        };
      }
    );
}
