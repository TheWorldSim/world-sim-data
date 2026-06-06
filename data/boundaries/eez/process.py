from dataclasses import dataclass

import ipdb
import os
import sys

import geopandas as gpd
import matplotlib.pyplot as plt
from pandas import Series
from shapely import LineString
from shapely.ops import transform


current_directory = os.path.dirname(os.path.abspath(__file__))
src_directory = os.path.abspath(current_directory + "/../../../src")
data_directory = os.path.abspath(current_directory + "/../../../data")
for path in [src_directory, data_directory]:
    if path not in sys.path:
        sys.path.append(path)

from boundaries.countries.process import get_boundaries
from geo_utils import join_linestrings


input_file_path = current_directory + "/ospar_eez_2025_01_001.csv"
output_file_path = current_directory + "/uk_eez.geojson"
# Reduce precision to 1 decimal places: https://xkcd.com/2170/
LOW_RES_DP = 2


def process():
    print("Processing UK EEZ (Exclusive Economic Zone) data.  Modified to include the boundaries of country borders and non-EEZ boundaries such as between the UK and France.")
    UK_EEZs = get_UK_EEZ()
    # Save to file
    UK_EEZs.joined_low_res.to_file(
        output_file_path,
        driver="GeoJSON",
        description=f"UK EEZ and national boundaries with {LOW_RES_DP} dp resolution geometry",
    )
    plot_eezs(UK_EEZs)


@dataclass
class UK_EEZs:
    eez: gpd.GeoSeries
    eez_low_res: gpd.GeoSeries
    joined: gpd.GeoDataFrame
    joined_low_res: Series

def get_UK_EEZ() -> UK_EEZs:
    uk_name = "United Kingdom"

    df = gpd.read_file(input_file_path)
    uk = df[df["CP"] == uk_name]
    lines = gpd.GeoSeries.from_wkt(uk["the_geom"])
    # Swap the lat and lon coordinates as they are in the wrong order in the data
    swapped = lines.apply(lambda geom: transform(lambda x, y, z=None: (y, x), geom))
    swapped = swapped.set_crs("EPSG:4326")

    low_res = swapped.simplify(0.19)

    ie_gb_nri_boundary = get_boundaries().ie_gb_nri_boundary
    joined_linestring = join_linestrings([
        ie_gb_nri_boundary,
        # goes clockwise around the UK EEZ starting from north of ireland
        low_res.values[0].geoms[1].reverse(),
        low_res.values[0].geoms[0],
    ], close=True)

    joined_gdf = gpd.GeoDataFrame(geometry=[joined_linestring], crs="EPSG:4326")
    joined_gdf_low_res = joined_gdf.copy().simplify(0.1)

    # Reduce precision to LOW_RES_DP decimal places
    low_res = low_res.apply(lambda geom: transform(lambda x, y, z=None: (round(x, LOW_RES_DP), round(y, LOW_RES_DP)), geom))
    joined_low_res = joined_gdf_low_res.apply((lambda geom: transform(lambda x, y, z=None: (round(x, LOW_RES_DP), round(y, LOW_RES_DP)), geom)))


    return UK_EEZs(
        eez=swapped,
        eez_low_res=low_res,
        joined=joined_gdf,
        joined_low_res=joined_low_res,
    )


def plot_eezs(uk_eez: UK_EEZs):
    fig, ax = plt.subplots(figsize=(8,8))
    uk_eez.joined.plot(ax=ax, edgecolor="purple")
    uk_eez.eez.plot(ax=ax, edgecolor="blue", linestyle="dashed")
    uk_eez.joined_low_res.plot(ax=ax, edgecolor="green")
    uk_eez.eez_low_res.plot(ax=ax, edgecolor="red", linestyle="dotted")
    ax.set_title("UK EEZ")
    plt.show()


if __name__ == "__main__":
    process()
