{
  description = "Development environment for bilibili-linux";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-26.05";

  outputs = { nixpkgs, ... }:
    let
      systems = [
        "x86_64-linux"
        "aarch64-linux"
      ];
      forAllSystems = nixpkgs.lib.genAttrs systems;
    in
    {
      devShells = forAllSystems (system:
        let
          pkgs = import nixpkgs { inherit system; };
          electronRuntimeLibraries = with pkgs; [
            alsa-lib
            at-spi2-atk
            at-spi2-core
            atk
            cairo
            cups
            dbus
            expat
            glib
            gtk3
            libgbm
            libx11
            libxcomposite
            libxdamage
            libxext
            libxfixes
            libxrandr
            libxcb
            libxkbcommon
            nspr
            nss
            pango
            systemd
          ];
        in
        {
          default = pkgs.mkShell {
            packages = with pkgs; [
              bash
              electron
              nodejs_24
              pnpm
              curl
              exiftool
              file
              git
              gnugrep
              gnused
              gnutar
              p7zip
              python3
              unzip
              wget
              which
            ];

            LD_LIBRARY_PATH = pkgs.lib.makeLibraryPath electronRuntimeLibraries;

            shellHook = ''
              echo "bilibili-linux development shell: Node $(node --version), pnpm $(pnpm --version)"
              echo "Run pnpm install, then tools/setup-bilibili.sh for the initial client bootstrap."
            '';
          };
        });
    };
}
