#!/bin/bash

! getopt --test > /dev/null
if [[ ${PIPESTATUS[0]} -ne 4 ]]; then
    echo 'I’m sorry, `getopt --test` failed in this environment.'
    exit 1
fi

OPTIONS=snp:
LONGOPTS=shell,nodep,procs:

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
    echo "$0: No positional arguments are supported."
    exit 4
fi

if [ $procs -lt 0 ]; then procs=0; fi


DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
export JULIA_PROJECT="$DIR"

if [ $shell = "n" ]; then
    cmd=""
    if [ $nodep = "n" ]; then
        cmd="$cmd import Pkg; Pkg.instantiate();"
    fi

    cmd="$cmd import napire; napire.web.start(\"$DIR/web\")"

    if [ $procs -eq 0 ]; then
        echo "$cmd" | julia
    else
        echo "$cmd" | julia -p "$procs"
    fi
else
    tmp=$(mktemp)
    echo "using Revise" >> "$tmp"
    echo "import napire" >> "$tmp"

    if [ $procs -eq 0 ]; then
        julia -L "$tmp"
    else
        julia -L "$tmp" -p "$procs"
    fi

    rm "$tmp"
fi
