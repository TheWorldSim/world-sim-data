# World Sim data

This data repo was used to support The World Sim ([see old README](README_archived.md)) but
is now used as a general repository for data to support different projects
like [WikiSim.org](https://wikisim.org) and others.

## Dev

Some data processing tasks use Python.  To activate a virtual environment and install
the dependencies, run:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### Jupyter Notebook

From the root directory of the project:

1. run `jupyter lab --port=8899 --IdentityProvider.token='secretb629' --ServerApp.open_browser=False`
2. copy the URL from the terminal, which should look something like `http://localhost:8899/lab?token=secretb629`
3. In visual studio code, open the process.ipynb file, run the block with shift + enter
4. When prompted for the URL to the python kernel, paste the URL from step 3 and press enter

For debugging in visual studio code you can set a breakpoint in the gutter of the
python file and then run that cell in debug mode using shift + ctrl + enter (instead of ctrl + enter).
This will give you a REPL at the breakpoint.

### Jupyter diffs

To ensure minimal diffs of Jupyter notebooks are committed then we install a
git commit hook: `cp hooks/nbstrip-staged.sh .git/hooks/pre-commit`
