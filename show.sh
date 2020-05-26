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

OPTIONS=nf:

nodep=n
procs=$(grep -c \^processor /proc/cpuinfo)

while getopts $OPTIONS varname; do
    case "$varname" in
        n)
            nodep=y
            ;;
        f)
            RESULTFILE="$OPTARG"
            ;;
        *)
            echo "Usage: $0 [-n] -f FILE"
            echo ""
            echo "Flags:"
            echo "  -n  Skip checking, downloading and building the dependencies to save some time."
            echo "  -f  Result file to read."
            exit 1
            ;;
    esac
done

if [ -z "$RESULTFILE" ]; then echo "You must provide the -f flag."; exit 1; fi

nodep=n
procs=$(grep -c \^processor /proc/cpuinfo)

RESULTFILE="`realpath $RESULTFILE`"

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
export JULIA_PROJECT="$DIR"
export JULIA_REVISE_INCLUDE="1"

loadcode="
import napire
"

tmp=$(mktemp)
trap "{ rm -f '$tmp'; }" EXIT


if [ $nodep = "n" ]; then
    deps="import Pkg; Pkg.instantiate();"
fi
echo "$deps $loadcode; import napire; napire.web.start_show(\"$DIR/web/\", \"$RESULTFILE\");" > "$tmp"

julia "$tmp"
