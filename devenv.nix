{
  pkgs,
  lib,
  config,
  inputs,
  ...
}:

{
  env.GREET = "ship";
  packages = [
    pkgs.git
    pkgs.nodejs
    pkgs.electron
    pkgs.python3
    pkgs.pkg-config
    pkgs.nh
  ];

  env.LD_LIBRARY_PATH = lib.makeLibraryPath [
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
  ];

  # This often helps Electron find the "right" binary on NixOS
  # Using /bin to point to the wrapper script which handles paths correctly
  env.ELECTRON_OVERRIDE_DIST_PATH = "${pkgs.electron}/bin";

  # GSettings schema fix for file dialogs etc.
  env.XDG_DATA_DIRS = "${pkgs.gsettings-desktop-schemas}/share/gsettings-schemas/${pkgs.gsettings-desktop-schemas.name}:${pkgs.gtk3}/share/gsettings-schemas/${pkgs.gtk3.name}:$XDG_DATA_DIRS";

  enterShell = ''
    git --version
    echo "Devenv for Electron ready!"
    echo "If npm run dev still fails, try running: ELECTRON_OVERRIDE_DIST_PATH=${pkgs.electron}/bin npm run dev"
  '';
}
