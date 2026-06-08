import ipdb
import os
import sys
from typing import cast

import geopandas as gpd
import matplotlib.pyplot as plt
import h3
from shapely.geometry import Polygon

current_directory = os.path.dirname(os.path.abspath(__file__))
src_directory = os.path.abspath(current_directory + "/../../src")
data_directory = os.path.abspath(current_directory + "/../../data")
for path in [src_directory, data_directory]:
    if path not in sys.path:
        sys.path.append(path)


from constants import LAT_LON_LOW_RES_DP
from geo_utils import swap_lat_lng
# from boundaries.countries.process import get_boundaries


resolution = 4
uk_eez = gpd.read_file(os.path.join(data_directory, "boundaries/eez/uk_eez.geojson"))


def process():
    eez = uk_eez
    h3_cells = get_h3_cells(eez)
    print(f"Number of H3 cells covering the UK EEZ at resolution {resolution}: {len(h3_cells)}")
    save_h3_cells(h3_cells)
    ax = plot_eez(eez)
    plot_h3(ax, h3_cells)


def get_h3_cells(eez):
    eez_lat_lon = eez.geometry.iloc[0].coords
    eez_polygon = Polygon(eez_lat_lon)
    eez_h3_polygon = h3.geo_to_h3shape(eez_polygon)
    cells = h3.polygon_to_cells(eez_h3_polygon, res=resolution)
    return cells


# Useful for debugging
def save_h3_cells(cells):
    cells = sorted(cells)
    with open(os.path.join(current_directory, f"uk_eez_h3_res_{resolution}.txt"), "w") as f:
        for cell in cells:
            lat, lon = h3.cell_to_latlng(cell)
            f.write(f"{cell},{round(lat, LAT_LON_LOW_RES_DP)},{round(lon, LAT_LON_LOW_RES_DP)}\n")


def plot_eez(eez):
    fig, ax = plt.subplots(figsize=(10, 10))
    eez.plot(ax=ax)
    # plt.show()
    return ax


def plot_h3(ax, h3_cells):
    for cell in h3_cells:
        boundary = swap_lat_lng(list(h3.cell_to_boundary(cell)))
        boundary.append(boundary[0])
        x, y = zip(*boundary)
        ax.plot(x, y, color="red")
    plt.show()


if __name__ == "__main__":
    process()
