import ipdb
import os
import sys

import geopandas as gpd
import matplotlib.pyplot as plt
from shapely.ops import transform


current_directory = os.path.dirname(os.path.abspath(__file__))
src_directory = os.path.abspath(current_directory + "/../../../src")
if src_directory not in sys.path:
    sys.path.append(src_directory)


input_file_path = current_directory + "/ospar_eez_2025_01_001.csv"
output_file_path = current_directory + "/uk_eez.geojson"
# Reduce precision to 1 decimal places: https://xkcd.com/2170/
LOW_RES_DP = 1


def process():
    print("Processing UK EEZ (Exclusive Economic Zone) data")
    UK_EEZs = get_UK_EEZ()
    # Save to file
    UK_EEZs["low_res"].to_file(
        output_file_path,
        driver="GeoJSON",
        description=f"UK EEZ with {LOW_RES_DP} dp resolution geometry",
    )
    plot_eezs(UK_EEZs)


def get_UK_EEZ():
    with open(input_file_path, "r") as f:
        uk_name = "United Kingdom"

        df = gpd.read_file(input_file_path)
        uk = df[df["CP"] == uk_name]
        lines = gpd.GeoSeries.from_wkt(uk["the_geom"])
        # Swap the lat and lon coordinates as they are in the wrong order in the data
        swapped = lines.apply(lambda geom: transform(lambda x, y, z=None: (y, x), geom))

        swapped = swapped.set_crs("EPSG:4326")
        low_res = swapped.simplify(0.19)
        # Reduce precision to LOW_RES_DP decimal places
        low_res = low_res.apply(lambda geom: transform(lambda x, y, z=None: (round(x, LOW_RES_DP), round(y, LOW_RES_DP)), geom))

    return { "swapped": swapped, "low_res": low_res }


def plot_eezs(uk_eez):
    swapped = uk_eez["swapped"]
    low_res = uk_eez["low_res"]
    fig, ax = plt.subplots(figsize=(8,8))
    swapped.plot(ax=ax, edgecolor="blue")
    low_res.plot(ax=ax, edgecolor="red")
    ax.set_title("UK EEZ")
    plt.show()


if __name__ == "__main__":
    process()
