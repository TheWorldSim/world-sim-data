
Data obtained from:

European electrical power grid data (position, nominal capacity, reactance, resistance, dc/ac etc.): https://zenodo.org/records/18619025  (and paper: https://www.nature.com/articles/s41597-025-04550-7 )

## Grid viewers

From this directory run `uv run python -m http.server`, then open http://localhost:8000/html_demo/grid_power_flow.html (interactive power flow) or http://localhost:8000/html_demo/grid_display.html (map of the lines and links, coloured by voltage: viridis for AC in bands <250, <380, <700 and ≥700 kV; light blue to dark purple, dashed, for DC in 4 equal-count groups).

Both pages share `html_demo/grid_data.js` (data set and area selection, CSV loading) and `html_demo/grid_core.js` (parsing and solver).

The demo data loads by default. Use the "Data set" dropdown to switch (it reloads the page with `?data=<dir>`, relative to this directory, e.g. `?data=eur/processed`); add more entries to `DATASETS` in `html_demo/grid_data.js`, or type any directory into the URL. A data set needs `buses.csv` and `lines.csv`; `links.csv` and `injections.csv` (`bus_id,mw` example injections, power flow page only) are optional.

A data set can hold several unconnected areas (the European data has about 170, from continental Europe down to Ireland and Scottish fragments). When it does, an "Area" dropdown appears, largest first, labelled with bus count and lon/lat range; the choice is kept in `?area=<n>` (0 = largest). The power flow page solves only the selected area (the largest, about 1000 buses, takes several seconds to load); the display page also offers "All areas" (`?area=all`).
