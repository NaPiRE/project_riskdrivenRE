#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
echo "import Pkg; Pkg.instantiate(); import napire; napire.web.start()" | julia "--project=$DIR" 
