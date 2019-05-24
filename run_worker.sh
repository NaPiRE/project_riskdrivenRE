#!/bin/bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
export JULIA_PROJECT="$DIR"
export JULIA_REVISE_INCLUDE="1"

tmp=$(mktemp)
trap "{ rm -f '$tmp'; }" EXIT

echo "
using Revise

files = [];
for (root, _, dirfiles) in walkdir(\"$DIR/src\")
    for file in dirfiles
        push!(files, joinpath(root, file));
    end
end

@async Revise.entr(files, [ ]) do
    println(\"-- reload --\")
    println()
end
using napire
import napire

import Distributed
Distributed.start_worker()
" > "$tmp"

julia "$tmp"
