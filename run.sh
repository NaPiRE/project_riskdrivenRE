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

OPTIONS=svnrp:

shell=n rerun=n nodep=n revise=n

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
        n)
            nodep=y
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
            echo "  -n      Skip checking, downloading and building the dependencies to save some time."
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

    if [ $nodep = "n" ]; then
        ( cd "$DIR/userweb" && npm install && npm run build-prod || echo "Failed compiling angular app" )
    fi

    echo "$deps $loadcode; import napire; napire.web.start(joinpath(\"$DIR\", \"results\"), $procs, revise_enabled, Dict(\"/web/\" => \"$DIR/web\", \"/userweb/\" => \"$DIR/userweb/build-prod\"));" > "$tmp"

    julia "$tmp"
fi
