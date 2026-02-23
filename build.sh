#!/bin/bash

# Clean and rebuild
rm -rf dist
bun update
tsc -p tsconfig.json --outDir dist

# Find collector-* directories (excluding collector-common-lib) and copy dist to each
find .. -maxdepth 1 -type d -name "collector-*" ! -name "collector-common-lib" | while read -r path; do
    echo "working on $path/collector-common-lib"
    rm -rf "$path/collector-common-lib"
    cp package.dist.json "dist/package.json"
    cp -r dist "$path/collector-common-lib"

    cur_path=$(pwd)
    cd "$path"
    bun update common-lib
    cd "$cur_path"
done