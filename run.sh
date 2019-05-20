#!/bin/bash
set -e

! getopt --test > /dev/null
if [[ ${PIPESTATUS[0]} -ne 4 ]]; then
    echo 'I’m sorry, `getopt --test` failed in this environment.'
    exit 1
fi

OPTIONS=hsnp:
LONGOPTS=help,shell,nodep,procs:

# -use ! and PIPESTATUS to get exit code with errexit set
# -temporarily store output to be able to check for errors
# -activate quoting/enhanced mode (e.g. by writing out “--options”)
# -pass arguments only via   -- "$@"   to separate them correctly
! PARSED=$(getopt --options=$OPTIONS --longoptions=$LONGOPTS --name "$0" -- "$@")
if [[ ${PIPESTATUS[0]} -ne 0 ]]; then
    # e.g. return value is 1
    #  then getopt has complained about wrong arguments to stdout
    exit 2
fi
# read getopt’s output this way to handle the quoting right:
eval set -- "$PARSED"

shell=n nodep=n
procs=$(grep -c \^processor /proc/cpuinfo)
procs=$(($procs - 1))
default_procs="y"

# now enjoy the options in order and nicely split until we see --
while true; do
    case "$1" in
        -s|--shell)
            shell=y
            shift
            ;;
        -n|--nodep)
            nodep=y
            shift
            ;;
        -p|--procs)
            procs="$2"
            default_procs="n"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [--shell|--nodep|--procs=Nm|--help]"
            exit 0
            ;;
        --)
            shift
            break
            ;;
        *)
            echo "Programming error"
            exit 3
            ;;
    esac
done

# handle non-option arguments
if [[ $# -ne 0 ]]; then
    echo "$0: No positional arguments are supported. Try --help."
    exit 4
fi

if [ $procs -lt 0 ]; then procs=0; fi


DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
export JULIA_PROJECT="$DIR"
export JULIA_REVISE_INCLUDE="1"

loadcode="
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
import napire
println(\"napire module loaded\")
"

tmp=$(mktemp)
trap "{ rm -f '$tmp'; }" EXIT

if [ $shell = "n" ]; then
    if [ $nodep = "n" ]; then
        deps="import Pkg; Pkg.instantiate();"
    fi
    echo "$deps $loadcode; import napire; napire.web.start(\"$DIR/web\", joinpath(\"$DIR\", \"results\"));" > "$tmp"

    jargs=""
else
    echo "atreplinit() do repl
    @eval begin
        $loadcode
    end
end"> "$tmp"

    jargs="-L"
fi

if [ $procs -eq 0 ]; then
    julia $jargs "$tmp"
else
    julia -p "$procs" $jargs "$tmp"
fi
