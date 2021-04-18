#!/bin/bash

#
# NaPiRE trouble predictor
# Copyright (C) 2019, TU Berlin, ASET, Florian Wiesweg
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program. If not, see <http://www.gnu.org/licenses/>.
#

set -e

OPTIONS=svdnjrp:

shell=n rerun=n download=n nodep=n userweb=n revise=n

if [ -e /proc/cpuinfo ]; then
    procs=$(grep -c \^processor /proc/cpuinfo)
else
    procs=$(sysctl -n hw.ncpu)
fi

while getopts $OPTIONS varname; do
    case "$varname" in
        s)
            shell=y
            ;;
        v)
            rerun=y
            ;;
        d)
            download=y
            ;;
        n)
            nodep=y
            ;;
        j)
            userweb=y
            ;;
        r)
            revise=y
            ;;
        p)
            procs="$OPTARG"
            ;;
        *)
            echo "Usage: $0 [-s|-v] [-n|-r|-p]"
            echo ""
            echo "Modes (exclusive):"
            echo "  (default)   Start web ui to manage tasks"
            echo "  -s          Start a Julia REPL with an initialised environment."
            echo "  -v          Re-run all tasks found in the results directory"
            echo ""
            echo "Additional flags: "
            echo "  -d      Do not use system julia, but download and extract it if necessary"
            echo "  -n      Skip checking the julia dependencies to save some time"
            echo "  -j      Compile userweb angular application"
            echo "  -r      Load Julia's Revise module to simplify debugging."
            echo "  -p N    Override the number of parallel processes forked to speed up calculations (defaults to $procs for your CPU)"
            exit 1
            ;;
    esac
done

if [ "$shell" = "y" -a "$rerun" = "y" ]; then
    echo "Choose between default, shell and rerun mode."
    exit 2
fi

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
export JULIA_PROJECT="$DIR"
export JULIA_REVISE_INCLUDE="1"

loadcode="revise_enabled = false"
if [ $revise == "y" ]; then
    echo "Enabling revise"
    loadcode="
revise_enabled = true
using Revise

files = [];
for (root, _, dirfiles) in walkdir(\"$DIR/src\")
    for file in dirfiles
        push!(files, joinpath(root, file));
    end
end

@async Revise.entr(files, [ ]) do
    println(\"-- reload --\")
end
"
fi
loadcode="$loadcode
import napire
"

tmp=$(mktemp)
trap "{ rm -f '$tmp'; }" EXIT

if [ $download = "y" ]; then
    outfile="julia.tar.gz"
    url="https://julialang-s3.julialang.org/bin/linux/x64/1.1/julia-1.1.1-linux-x86_64.tar.gz"
    sha="a64d6ddb6d9cb1954b28272f2ac1ce93ce666722 $outfile"
    outfile="$DIR/$outfile"
    inner_path="julia-1.1.1/bin"

    juliadir="$DIR/__julia__"

    if [ ! -d "$juliadir" ]; then
        if [ -e "$outfile" ]; then
            # ah test parentheses arent my thing
            if [ ! -e "$outfile.sha1" ]; then
                # remove partial download
                rm "$outfile"
            fi
        fi

        if [ ! -e "$outfile" ]; then
            echo "Downloading julia"
            wget "$url" -O "$outfile" --show-progress
        else
            echo "File  already downloaded: $outfile"
        fi

        echo "$sha" > "$outfile.sha1"
        sha1sum -c "$outfile.sha1"
        if [ $? -ne 0 ]; then
            echo "Checksum verification failed: $outfile"
        fi

        mkdir "$juliadir"
        (set -e && cd "$juliadir" && tar -xf "$outfile")
        if [ $? -ne 0 ]; then
            echo "File extraction failed: $outfile"
        fi
    fi

    export PATH="$juliadir/$inner_path:$PATH"
fi

if [ $nodep = "n" ]; then
    deps="import Pkg; Pkg.instantiate();"
fi

if [ $shell = "y"  ]; then
    echo "Starting shell..."
    echo "atreplinit() do repl
    @eval begin
        $loadcode
    end
end"> "$tmp"

    julia -L "$tmp"
elif [ $rerun = "y" ]; then
    echo "Starting rerun..."

    echo "$deps $loadcode; import napire; napire.web.start_rerun(joinpath(\"$DIR\", \"results\"), $procs, revise_enabled);" > "$tmp"

    julia "$tmp"
else
    echo "Starting web ui..."

    if [ $userweb = "y" ]; then
        ( cd "$DIR/userweb" && npm install && npm run build-prod || echo "Failed compiling angular app" )
    fi

    echo "$deps $loadcode; import napire; napire.web.start(joinpath(\"$DIR\", \"results\"), $procs, revise_enabled, Dict(\"/web/\" => \"$DIR/web\", \"/userweb/\" => \"$DIR/userweb/build-prod\"));" > "$tmp"

    julia "$tmp"
fi
