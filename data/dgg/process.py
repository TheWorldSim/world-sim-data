from dataclasses import dataclass

import ipdb
import os
import sys
from typing import cast

import geopandas as gpd
import matplotlib.pyplot as plt
import h3
from shapely.geometry import Point, Polygon

current_directory = os.path.dirname(os.path.abspath(__file__))
src_directory = os.path.abspath(current_directory + "/../../src")
data_directory = os.path.abspath(current_directory + "/../../data")
for path in [src_directory, data_directory]:
    if path not in sys.path:
        sys.path.append(path)


from constants import LAT_LON_LOW_RES_DP, H3_RESOLUTION
from geo_utils import swap_lat_lng
from boundaries.countries.process import get_boundaries


uk_eez = gpd.read_file(os.path.join(data_directory, "boundaries/eez/uk_eez.geojson"))
uk_land_polygons = get_boundaries().uk_all


# For the UK these H3 cell IDs help shape the land mask to be more accurate and
# to ensure the areas of the UK land polygons is about equal to the H3 cells:
#    Area of UK land polygons: 33.095  (arbitrary units)
#    Area of H3 cells marked as land: 33.148  (arbitrary units)
h3_cell_ids_to_force_marking_as_land = {
    "841908dffffffff",
    "8419083ffffffff",
    "8419095ffffffff",  # Lock Craignish
    "841956dffffffff",  # Cinn Tìre peninsula / Kintyre peninsula
    "841953bffffffff",  # Ynys Môn island / Anglesey island
    "8409a47ffffffff",  # Shetlands
    "8419289ffffffff",  # Orkneys
    "84195a5ffffffff",  # Pembroke Wales
    # "8419511ffffffff",  # Liverpool
    # "8419529ffffffff",  # Strangford Lough
    "841821dffffffff",  # South West of Northern Ireland
    # "84194e3ffffffff",  # Kent
    # "841959bffffffff",  # East solent
}


@dataclass
class H3CellData:
    h3_cell_id: str
    lat: float
    lon: float
    is_land: bool
    has_some_land: bool


def process():
    eez = uk_eez
    h3_cells = get_h3_cell_ids(eez)
    mark_h3_cells_over_land(h3_cells, land_polygons=uk_land_polygons)
    print(f"Number of H3 cells covering the UK EEZ at resolution {H3_RESOLUTION}: {len(h3_cells)}")
    print(f"Total marked as land: {sum(cell.is_land for cell in h3_cells)} (having some land: {sum(cell.has_some_land for cell in h3_cells)})")
    print("Area of UK land polygons:", round(sum(polygon.area for polygon in uk_land_polygons), 3))
    print("Area of H3 cells marked as land:", round(sum(h3_cell_id_to_polygon(cell.h3_cell_id).area for cell in h3_cells if cell.is_land), 3))
    print("Area of H3 cells marked as having some land:", round(sum(h3_cell_id_to_polygon(cell.h3_cell_id).area for cell in h3_cells if cell.has_some_land), 3))
    save_h3_cells(h3_cells)

    fig, ax = plt.subplots(figsize=(10, 10))
    add_eez_to_plot(ax, eez)
    add_land_to_plot(ax, uk_land_polygons)
    add_h3_cells_to_plot(ax, h3_cells)
    add_h3_land_cells_to_plot(ax, h3_cells)
    plt.show()


def get_h3_cell_ids(eez) -> list[H3CellData]:
    eez_lat_lon = eez.geometry.iloc[0].coords
    eez_polygon = Polygon(eez_lat_lon)
    eez_h3_polygon = h3.geo_to_h3shape(eez_polygon)
    h3_cell_ids = h3.polygon_to_cells(eez_h3_polygon, res=H3_RESOLUTION)

    cells: list[H3CellData] = []
    for h3_cell_id in h3_cell_ids:
        lat, lon = h3.cell_to_latlng(h3_cell_id)
        cells.append(H3CellData(h3_cell_id=h3_cell_id, lat=lat, lon=lon, is_land=False, has_some_land=False))
    return cells


def mark_h3_cells_over_land(h3_cells: list[H3CellData], land_polygons: list[Polygon]):
    for h3_cell in h3_cells:
        boundary = h3_cell_id_to_polygon(h3_cell.h3_cell_id)
        is_land = any((land_polygon.intersection(boundary).area / boundary.area) >= 0.5 for land_polygon in land_polygons)
        some_land = any((land_polygon.intersection(boundary).area / boundary.area) >= 0.01 for land_polygon in land_polygons)
        h3_cell.is_land = is_land or h3_cell.h3_cell_id in h3_cell_ids_to_force_marking_as_land
        h3_cell.has_some_land = h3_cell.is_land or some_land


# Useful for debugging
def save_h3_cells(cells: list[H3CellData]):
    cells = sorted(cells, key=lambda cell: cell.h3_cell_id)
    with open(os.path.join(current_directory, f"uk_eez_h3_res_{H3_RESOLUTION}.txt"), "w") as f:
        f.write(f"h3 cell id (minus ffffffff), lat, lon, is land (L) or contains some land (l)\n")
        for cell in cells:
            short_h3_cell_id = cell.h3_cell_id[:7]
            lat, lon = h3.cell_to_latlng(cell.h3_cell_id)
            lat = round(lat, LAT_LON_LOW_RES_DP)
            lon = round(lon, LAT_LON_LOW_RES_DP)
            land = "L" if cell.is_land else ("l" if cell.has_some_land else "")
            f.write(f"{short_h3_cell_id},{lat},{lon},{land}\n")


def load_h3_cells():
    h3_cells: list[H3CellData] = []
    with open(os.path.join(current_directory, f"uk_eez_h3_res_{H3_RESOLUTION}.txt"), "r") as f:
        lines = f.readlines()[1:]  # Skip header
        for line in lines:
            short_h3_cell_id, lat, lon, over_land = line.strip().split(",")
            h3_cell_id = short_h3_cell_id + "ffffffff"
            lat = float(lat)
            lon = float(lon)
            is_land = over_land == "L"
            has_some_land = is_land or over_land == "l"
            h3_cells.append(H3CellData(h3_cell_id=h3_cell_id, lat=lat, lon=lon, is_land=is_land, has_some_land=has_some_land))
    return h3_cells


def add_eez_to_plot(ax, eez):
    eez.plot(ax=ax)


def add_land_to_plot(ax, land_polygons: list[Polygon]):
    land_gdf = gpd.GeoDataFrame(geometry=land_polygons)
    land_gdf.plot(ax=ax, color="gray")


def add_h3_cells_to_plot(ax, h3_cells: list[H3CellData]):
    for cell in h3_cells:
        boundary = h3_cell_id_to_polygon(cell.h3_cell_id)
        x, y = zip(*boundary.exterior.coords)
        ax.plot(x, y, color="red")


def add_h3_land_cells_to_plot(ax, h3_cells: list[H3CellData]):
    for cell in h3_cells:
        boundary = h3_cell_id_to_polygon(cell.h3_cell_id)
        x, y = zip(*boundary.exterior.coords)
        if cell.is_land:
            ax.fill(x, y, color="green", alpha=0.5)
        elif cell.has_some_land:
            ax.fill(x, y, color="yellow", alpha=0.25)


def h3_cell_id_to_polygon(h3_cell_id: str) -> Polygon:
    boundary = swap_lat_lng(list(h3.cell_to_boundary(h3_cell_id)))
    return Polygon(boundary)


if __name__ == "__main__":
    process()
