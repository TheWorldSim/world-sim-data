import os
import sys

import h3
import matplotlib.pyplot as plt
from pyproj import Transformer

this_directory = os.path.dirname(os.path.abspath(__file__))
data_directory = os.path.abspath(this_directory + "/../../../data")
for path in [data_directory]:
    if path not in sys.path:
        sys.path.append(path)

from aggregate_land_coverage_by_h3_cell import (
    regions,
)
from find_dominant_land_coverage_by_h3_cell import (
    load_dominant_land_coverage_data_for_region,
)
from map_class_number_and_name import SimplifiedAreaType


# Fairly arbitrary units
THRESHOLD_DOMINANT_COVERAGE_TYPE_PERCENTAGE = 21411 // 2


def plot_data():
    # transformer = Transformer.from_crs("EPSG:4326", "EPSG:3857", always_xy=True)

    for region in regions:
        data = load_dominant_land_coverage_data_for_region(region.name)
        h3_cells = list(data.values())

        # Find median cumulative percentages
        cumulative_percentages = [h3_cell.dominant_simplified_coverage_type_percentage for h3_cell in h3_cells]
        median_cumulative_percentage = sorted(cumulative_percentages)[len(cumulative_percentages) // 2]
        print(f"Region: {region.name}, Median cumulative percentage: {median_cumulative_percentage}")

        for h3_cell in h3_cells:
            if h3_cell.dominant_simplified_coverage_type_percentage < THRESHOLD_DOMINANT_COVERAGE_TYPE_PERCENTAGE:
                continue

            boundary = h3.cell_to_boundary(h3_cell.h3_cell_id)

            # Convert boundary as [(lat, lon), ...] to x/y for plotting
            ys, xs = zip(*boundary)

            # This will transform the lat lon coordinates to the web mercator
            # projection.
            # xs, ys = transformer.transform(xs, ys)  # pass lon,lat sequences

            # Plot the boundary, coloring it based on h3_cell.dominant_land_coverage_type
            color = map_land_coverage_type_to_color[h3_cell.dominant_simplified_coverage_type]
            plt.fill(xs, ys, color=color)

    plt.title("Dominant Land Coverage by H3 Cell")
    plt.xlabel("Longitude")
    plt.ylabel("Latitude")
    plt.axis("equal")
    plt.savefig("dominant_land_coverage_by_h3_cell.png", dpi=300, bbox_inches="tight")
    plt.show()


# Copied from energy-exlorer-v2/src/sim_3d/simple_sim/tile.ts
map_land_coverage_type_to_color: dict[SimplifiedAreaType, str] = {
    "woodland":     "#228B22",
    "arable":       "#DEB887",
    "grassland":    "#7CFC00",
    "wetland":      "#698b2e",
    "rock":         "#C9C9C9",
    "inland_water": "#399cff",
    "urban":        "#696969",
    "suburban":     "#D35555",
}


if __name__ == "__main__":
    plot_data()
