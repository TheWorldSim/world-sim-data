from dataclasses import asdict, dataclass
from typing import get_args
import ipdb
import json
import os
import sys

import h3
import matplotlib.pyplot as plt
import numpy as np
import rasterio
from pyproj import Transformer
import glob

this_directory = os.path.dirname(os.path.abspath(__file__))
data_directory = os.path.abspath(this_directory + "/../../../data")
for path in [data_directory]:
    if path not in sys.path:
        sys.path.append(path)

from map_class_number_and_name import SimplifiedAreaType, map_class_number_to_simplified_area_type

# Percentage data contains all 21 bands, one for each land cover type.
# The 21 categories (and CEH's aggregated 10 categories) are shown in Table 1 of the file
# data/land_coverage/uk/ceh_1km_data/supporting-documents/lcm2024productdocumentation.docx (which
# is downloaded according to the instructions in ./README.md#data-in-ceh_1km_data)
percentage_data_file_name = "2024lcm1km_percentage_target.tif"
h3_resolution = 5
output_file_path = f"{this_directory}/{{region_name}}_aggregated_land_coverage_h3_r{h3_resolution}.json"


@dataclass
class Region:
    name: str
    coordinate_reference_system: str

regions: list[Region] = [
    # British National Grid. EPSG: 27700
    Region(name="gb", coordinate_reference_system="EPSG:27700"),
    # TM 75 Irish Grid. EPSG: 29903
    Region(name="ni", coordinate_reference_system="EPSG:29903"),
]


@dataclass
class H3Cell:
    h3_cell_id: str
    pixel_count: int
    simplified_coverage_type_cumulative_percentages: dict[SimplifiedAreaType, int]
    any_pixel_non_zero_percentage: bool

    def __init__(self, h3_cell_id: str):
        self.h3_cell_id = h3_cell_id
        self.pixel_count = 0
        self.simplified_coverage_type_cumulative_percentages = dict.fromkeys(get_args(SimplifiedAreaType), 0)
        self.any_pixel_non_zero_percentage = False

    def add_percentage_for_simplified_coverage_type(self, simplified_coverage_type: SimplifiedAreaType, percentage: int):
        self.simplified_coverage_type_cumulative_percentages[simplified_coverage_type] += percentage

        # Choose one band to count the number of pixels in the H3 cell.  It
        # doesn't matter which one since they all have the same number of pixels.
        if simplified_coverage_type == "woodland":
            self.pixel_count += 1
        if percentage > 0:
            self.any_pixel_non_zero_percentage = True


# H3Cell indexed by h3_cell_id
type DataForRegion = dict[str, H3Cell]

def process():
    for region in regions:
        print(f"Processing region: {region.name}")

        data_for_region: DataForRegion = {}

        percentage_data_file_path = f"{this_directory}/ceh_1km_data/data/{region.name}{percentage_data_file_name}"
        with rasterio.open(percentage_data_file_path) as src:
            for band in range(1, 21 + 1):
                print(f"Processing band {band} (class number) of {src.count} for region with CRS {region.coordinate_reference_system}")
                percentage_data = src.read(band)
                process_data(data_for_region, region, band, percentage_data)

        save_aggregated_data_for_region(region.name, data_for_region)


def process_data(data_for_region: DataForRegion, region: Region, class_number: int, percentage_data: np.ndarray):
    # y is going from top to bottom, x is going from left to right.
    max_y, max_x = percentage_data.shape
    for y in range(max_y):
        print(f"Processing row {y} of {max_y} for band {class_number} of region {region.name} with CRS {region.coordinate_reference_system}")
        for x in range(max_x):
            percentage = int(percentage_data[y, x])
            simplified_area_type = map_class_number_to_simplified_area_type[class_number]
            h3_cell_id = pixel_coordinates_to_h3_cell_id(x, y, region.coordinate_reference_system)

            if h3_cell_id not in data_for_region:
                data_for_region[h3_cell_id] = H3Cell(h3_cell_id=h3_cell_id)
            data_for_region[h3_cell_id].add_percentage_for_simplified_coverage_type(simplified_area_type, percentage)


_cache_pixel_to_h3_cell = {}
def pixel_coordinates_to_h3_cell_id(x: int, y: int, coordinate_reference_system: str) -> str:
    if (x, y, coordinate_reference_system) in _cache_pixel_to_h3_cell:
        return _cache_pixel_to_h3_cell[(x, y, coordinate_reference_system)]

    lat, lon = get_lat_lon_from_pixel_coordinates(x, y, coordinate_reference_system)
    h3_cell_id = h3.latlng_to_cell(lat, lon, h3_resolution)

    _cache_pixel_to_h3_cell[(x, y, coordinate_reference_system)] = h3_cell_id
    return h3_cell_id


# Cache transforms/transformers per CRS to avoid reopening files repeatedly
_cache_crs = {}
def get_lat_lon_from_pixel_coordinates(x: int, y: int, coordinate_reference_system: str) -> tuple[float, float]:
    if coordinate_reference_system not in _cache_crs:
        # Search the local CEH data folder for a TIFF with the requested CRS
        ceh_data_dir = f"{this_directory}/ceh_1km_data/data"
        tif_paths = glob.glob(os.path.join(ceh_data_dir, "*.tif"))

        found = False
        for tif in tif_paths:
            try:
                with rasterio.open(tif) as src:
                    src_crs = src.crs
                    if src_crs is None:
                        continue
                    # Compare CRS strings like 'EPSG:27700'
                    if src_crs.to_string() == coordinate_reference_system:
                        transform = src.transform
                        transformer = Transformer.from_crs(src_crs, "EPSG:4326", always_xy=True)
                        _cache_crs[coordinate_reference_system] = {"transform": transform, "transformer": transformer}
                        found = True
                        break
            except Exception:
                continue

        if not found:
            raise ValueError(f"No TIFF with CRS {coordinate_reference_system} found in {ceh_data_dir}")

    entry = _cache_crs[coordinate_reference_system]
    transform = entry["transform"]
    transformer = entry["transformer"]

    # rasterio uses (row, col) ordering for pixel coordinates
    x_coord, y_coord = rasterio.transform.xy(transform, y, x, offset="center") # type: ignore

    # Transformer with always_xy=True uses (x, y) = (lon, lat) ordering
    lon, lat = transformer.transform(x_coord, y_coord)
    return lat, lon


def save_aggregated_data_for_region(region_name: str, data_for_region: DataForRegion):
    serializable: list[object] = []
    for h3_id, cell in data_for_region.items():
        if not cell.any_pixel_non_zero_percentage:
            continue
        cell_dict = asdict(cell)
        serializable.append(cell_dict)

    with open(output_file_path.format(region_name=region_name), "w") as f:
        json.dump(serializable, f, indent=2)


def load_aggregated_data_for_region(region_name: str) -> DataForRegion:
    with open(output_file_path.format(region_name=region_name), "r") as f:
        serializable = json.load(f)

    data_for_region: DataForRegion = {}
    for cell_dict in serializable:
        cell = H3Cell(h3_cell_id=cell_dict["h3_cell_id"])
        cell.pixel_count = cell_dict["pixel_count"]
        cell.simplified_coverage_type_cumulative_percentages = cell_dict["simplified_coverage_type_cumulative_percentages"]
        cell.any_pixel_non_zero_percentage = cell_dict["any_pixel_non_zero_percentage"]
        data_for_region[cell.h3_cell_id] = cell

    return data_for_region


if __name__ == "__main__":
    process()
