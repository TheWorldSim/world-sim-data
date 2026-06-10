
# Data fetching and processing

The data is fetched from Renewables Ninja API using data/wind_solar_capacity_factor/fetch_data.py script.

The data is now processed by the data/wind_solar_capacity_factor/process_data.py script.

There used to be a older system using data.ts but this requires documenting.

# OLD data.ts

TODO: better document where the data comes / came from for this code

[data.ts](data.ts) is used to generate the files:
* [data/_2018_texas_80_Vestas_V90_2000@core@0.0.10.csv](data/_2018_texas_80_Vestas_V90_2000@core@0.0.10.csv)
* [data/_2018_texas__offshore_80_Vestas_V90_2000@core@0.0.10.csv](data/_2018_texas__offshore_80_Vestas_V90_2000@core@0.0.10.csv)
* [data/_2018_united_kingdom_80_Vestas_V90_2000@core@0.0.10.csv](data/_2018_united_kingdom_80_Vestas_V90_2000@core@0.0.10.csv)
* [data/_2018_united_kingdom__offshore_80_Vestas_V90_2000@core@0.0.10.csv](data/_2018_united_kingdom__offshore_80_Vestas_V90_2000@core@0.0.10.csv)

These are used in [EnergyExplorer v1](https://wikisim.org/wiki/1080)
