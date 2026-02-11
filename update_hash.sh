#!/usr/bin/env bash

# Remove existing hash
sed -i 's/npmDepsHash = ".*"/npmDepsHash = ""/' flake.nix
HASH=$(nix build --show-trace 2>&1 | grep "got:" | awk '{print $2}')
sed -i "s/npmDepsHash = ""/npmDepsHash = "$HASH"/" flake.nix