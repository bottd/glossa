{
  description = "Glossa - a community lexicon Discord bot";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    treefmt-nix = {
      url = "github:numtide/treefmt-nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = { self, nixpkgs, flake-utils, treefmt-nix }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs {
          inherit system;
        };

        treefmtEval = treefmt-nix.lib.evalModule pkgs {
          projectRootFile = "flake.nix";
          programs = {
            prettier = {
              enable = true;
              includes = [ "*.js" "*.mjs" "*.ts" "*.json" "*.md" "*.yaml" "*.yml" ];
            };
            nixpkgs-fmt.enable = true;
          };
          settings.global.excludes = [
            "node_modules/*"
            "dist/*"
            "data/*"
            "pnpm-lock.yaml"
            "*.db"
          ];
        };
      in
      {
        formatter = treefmtEval.config.build.wrapper;

        checks = {
          formatting = treefmtEval.config.build.check self;
        };

        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            nodejs_22
            pnpm

            treefmtEval.config.build.wrapper
            nixpkgs-fmt

            git
            direnv
          ];
        };
      });
}
