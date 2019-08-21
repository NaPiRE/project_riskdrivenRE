NaPiRE Risk predictor:  Overview
------------------------------------

Based on data from the 2014 and 2018 runs of the NaPiRE survey (http://www.napire.org), this machine-learning-based tool implements a RESTful service predicting problems, causes, and their effects as potentially occurring in software development projects. To this end, we use Bayesian networks which are easily configurable from a web interface and can reach reasonable prediction recall and precision.

Please note that this repository includes two contributions licensed separately (the software is under GPLv3, the data is under CC BY 4.0). Details can be taken from the respective LICENCE.md files.

Compiling and Running
----------------------

* Run a reasonably unix-ish operating system (some Linux distribution, MacOS and Windows Subsystem for Linux might work, too).
* Install a recent version of julia (https://julialang.org/, at least 1.1.0) and make sure it's on your PATH
`sudo apt-get install julia`
* Install graphviz (https://www.graphviz.org/) and make sure it's on your PATH
`sudo apt-get install graphviz`
* If you want to work with the web interface used for the case study, you need to install a recent-ish version of npm to compile the Angular app.
`sudo apt-get install npm`
* Clone this repository, inspect the code and run `./run.sh`. By default, the web service will be available at `http://127.0.0.1:8888`, serving the evaluation interface at `/web` and the case study UI at `/userweb`.
* If you are only interested in looking at pre-computed results, run `./show.sh path/to/resultsfile.ser`.

It is most probably possible to run this on an average Windows as well, but will require some additional work. Please refer to `run.sh` for ideas on how to make this work.

Contributing
-------------

Please refer to CONTRIBUTING.md


CITING
-------------

Please refer to CITATION.md

