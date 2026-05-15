import os
import sys

import geopandas as gpd
import ipdb
import matplotlib.pyplot as plt
import pandas as pd
from shapely.geometry import Point

# Ensure the parent directory is in the system path
current_directory = os.path.dirname(os.path.abspath(__file__))
parent_directory = os.path.dirname(current_directory)
sys.path.append(parent_directory)

from files import output_file_path
from constants import (
    field_development_status,
    new_field_area,
    new_field_lon_coord,
    new_field_lat_coord,

    development_status_types,
)


def plot_on_map():
    # Load the processed solar farm data
    solar_df = pd.read_csv(output_file_path("solar"))

    summarise_data(solar_df)

    # Create a GeoDataFrame from the solar farm data
    geometry = [Point(xy) for xy in zip(solar_df[new_field_lon_coord], solar_df[new_field_lat_coord])]
    gdf = gpd.GeoDataFrame(solar_df, geometry=geometry)

    # # Load a base map of the UK (you can use a shapefile or GeoJSON)
    # uk_map = gpd.read_file("path_to_uk_shapefile.shp")

    # Plot the base map and the solar farms
    fig, ax = plt.subplots(figsize=(10, 10))
    # uk_map.plot(ax=ax, color="lightgrey")
    gdf.plot(ax=ax, color="yellow", markersize=5)

    plt.title("Solar Farms in the UK")
    plt.xlabel(new_field_lon_coord)
    plt.ylabel(new_field_lat_coord)
    plt.show()


def summarise_data(df):
    print(f"Total number of solar farms: {len(df)}")
    df_operational = df[df[field_development_status] == development_status_types["Operational"]]
    total_m2 = df_operational[new_field_area].sum()
    total_km2 = total_m2 / 1e6
    print(f"Total area of operational solar farms: {total_km2:.2f} km^2")

    total_m2_planned = df[new_field_area].sum()
    total_km2_planned = total_m2_planned / 1e6
    print(f"Total area planned of solar farms: {total_km2_planned:.2f} km^2")

    # print(f"Average installed capacity (MW): {df['Installed Capacity (MW)'].mean():.2f}")
    # print(f"Average predicted area (sqm): {df['Predicted Area (sqm)'].mean():.2f}")
    # print(f"Average farms density (W/sqm): {df['Power Density (W/sqm)'].mean():.2f}")
    # print(f"Development status distribution:\n{df['Development Status'].value_counts()}")


if __name__ == "__main__":
    plot_on_map()
