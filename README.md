NaPiRE trouble predictor:  Overview
------------------------------------

Based on data from the NaPiRE survey (http://www.re-survey.org), this machine-learning tool implements a RESTful service predicting causes/problems/effects in software engineering. It uses Bayesian networks which are easily configurable from a web interface and can reach reasonable prediction recall and precision.

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

It is most probably possible to run this on an average Windows as well, but will require some additional work. Please refer to `run.sh` for ideas on how to make this work.

Contributing
-------------

Please refer to CONTRIBUTING.md
