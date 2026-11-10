
Data obtained from:

European electrical power grid data (position, nominal capacity, reactance, resistance, dc/ac etc.): https://zenodo.org/records/18619025  (and paper: https://www.nature.com/articles/s41597-025-04550-7 ).  Download the buses.csv, lines.csv and links.csv into input/eur.


## Process the data

```bash
cd data/grid_electrical
uv run process.py
```


## Grid viewer

```bash
cd model
pnpm install
pnpm run dev
```

## Tests

```bash
uv run pytest
```

```bash
cd model
pnpm install
pnpm test
```
