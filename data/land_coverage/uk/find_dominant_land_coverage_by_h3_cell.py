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

from aggregate_land_coverage_by_h3_cell import (
    H3Cell,
    Region,
    h3_resolution,
    load_aggregated_data_for_region,
    regions,
)
from map_class_number_and_name import SimplifiedAreaType


output_file_path = f"{this_directory}/{{region_name}}_dominant_land_coverage_h3_r{h3_resolution}.json"


TYPES = list(get_args(SimplifiedAreaType))
type CumulativeLandCoverageTypePercentages = dict[SimplifiedAreaType, int]

@dataclass
class H3CellDominantLandCoverage:
    h3_cell_id: str
    dominant_simplified_coverage_type: SimplifiedAreaType
    dominant_simplified_coverage_type_percentage: int


def process():
    for region in regions:
        print(f"Processing region: {region.name}")
        data = load_aggregated_data_for_region(region.name)
        h3_cells = list(data.values())
        h3_cells_with_redistributed = [H3CellWithRedistributedPercentage(cell) for cell in h3_cells]

        process_h3_cells(region, h3_cells_with_redistributed)



@dataclass
class H3CellWithRedistributedPercentage:
    h3_cell_id: str
    simplified_coverage_type_cumulative_percentages: dict[SimplifiedAreaType, int]
    simplified_coverage_type_redistributed_percentages: dict[SimplifiedAreaType, float]

    def __init__(self, h3_cell: H3Cell):
        self.h3_cell_id = h3_cell.h3_cell_id
        self.simplified_coverage_type_cumulative_percentages = h3_cell.simplified_coverage_type_cumulative_percentages
        self.simplified_coverage_type_redistributed_percentages = dict.fromkeys(TYPES, 0.0)

    def get_percentage_coverage_map(self) -> dict[SimplifiedAreaType, float]:
        return {
            t: float(self.simplified_coverage_type_cumulative_percentages[t]) + self.simplified_coverage_type_redistributed_percentages[t]
            for t in TYPES
        }

    def get_dominant_type(self) -> tuple[SimplifiedAreaType, float]:
        max_type = None
        max_percentage = float("-inf")
        for t in TYPES:
            cumulative = float(self.simplified_coverage_type_cumulative_percentages[t])
            redistributed = self.simplified_coverage_type_redistributed_percentages[t]
            total = cumulative + redistributed
            if total > max_percentage:
                max_percentage = total
                max_type = t

        # Type guard
        if max_type is None:
            raise ValueError(f"Cell {self.h3_cell_id} has no coverage type percentages")

        return max_type, max_percentage

    def add_percentage_for_redistributed_type(self, simplified_coverage_type: SimplifiedAreaType, percentage: float):
        self.simplified_coverage_type_redistributed_percentages[simplified_coverage_type] += percentage


def process_h3_cells(region: Region, h3_cells: list[H3CellWithRedistributedPercentage]):
    # Initialize total and unused accumulators for every simplified type
    total_percentages: CumulativeLandCoverageTypePercentages = {t: 0 for t in TYPES}

    # Sum totals across all cells
    for cell in h3_cells:
        for t, v in cell.simplified_coverage_type_cumulative_percentages.items():
            total_percentages[t] = total_percentages.get(t, 0) + int(v)

    # Sort cells by their maximum type percentage (descending)
    def cell_max_percentage(cell: H3CellWithRedistributedPercentage) -> int:
        vals = list(cell.simplified_coverage_type_cumulative_percentages.values())
        return max((int(v) for v in vals), default=0)

    sorted_cells = sorted(h3_cells, key=cell_max_percentage, reverse=True)

    # dominant_coverage_type_from_max_percentage(total_percentages, sorted_cells, region)
    dominant_cells = dominant_coverage_type_from_redistributing_percentage(total_percentages, sorted_cells, region)

    save_dominant_land_coverage_data_for_region(region.name, dominant_cells)


def dominant_coverage_type_from_redistributing_percentage(
        total_percentages: CumulativeLandCoverageTypePercentages,
        sorted_cells: list[H3CellWithRedistributedPercentage],
        region: Region
    ):
    unused_percentages: dict[SimplifiedAreaType, float] = {t: 0.0 for t in TYPES}
    used_percentages: dict[SimplifiedAreaType, float] = {t: 0.0 for t in TYPES}

    dominant_cells: list[H3CellDominantLandCoverage] = []

    while sorted_cells:
        cell = sorted_cells.pop(0)
        # choose dominant type for this cell (based on current, possibly-updated values)
        dominant_type, dominant_percentage = cell.get_dominant_type()

        # accumulate non-dominant amounts into unused
        sum_other = 0
        for t, v in list(cell.get_percentage_coverage_map().items()):
            if t == dominant_type:
                continue
            unused_percentages[t] = unused_percentages[t] + v
            sum_other += v

        unused_percentages[dominant_type] -= sum_other
        # Also track the used percentage, just for debugging / analysis purposes
        used_percentages[dominant_type] += dominant_percentage + sum_other

        dominant_cells.append(
            H3CellDominantLandCoverage(
                h3_cell_id=cell.h3_cell_id,
                dominant_simplified_coverage_type=dominant_type,
                dominant_simplified_coverage_type_percentage=round(dominant_percentage + sum_other),
            )
        )

        # Redistribute each nonzero unused bucket pro-rata across remaining cells
        remaining_cells = sorted_cells
        for t in TYPES:
            # if t == "grassland":
            #     ipdb.set_trace()
            # total available occurrence of type `t` in remaining cells
            total_remaining = sum(c.simplified_coverage_type_cumulative_percentages[t] for c in remaining_cells)
            if total_remaining == 0:
                # nothing to redistribute to; keep the unused amount as-is
                continue

            ratio: float = unused_percentages[t] / total_remaining
            for c in remaining_cells:
                orig = c.simplified_coverage_type_cumulative_percentages[t]
                delta = ratio * orig
                c.add_percentage_for_redistributed_type(t, delta)

            # after distribution, clear the unused bucket for t
            unused_percentages[t] = 0

        # Now resort the cells based on their simplified_coverage_type_cumulative_percentages and simplified_coverage_type_redistributed_percentages
        sorted_cells = sorted(remaining_cells, key=cell_max_percentage, reverse=True)

    assess_usage(total_percentages, used_percentages, {t: int(round(v)) for t, v in unused_percentages.items()}, region)
    return dominant_cells


def cell_max_percentage(cell: H3CellWithRedistributedPercentage) -> float:
    cumulative_vals = cell.simplified_coverage_type_cumulative_percentages
    redistributed_vals = cell.simplified_coverage_type_redistributed_percentages
    max_val = 0.0
    for t in TYPES:
        cumulative = float(cumulative_vals[t])
        redistributed = redistributed_vals[t]
        val = cumulative + redistributed
        if val > max_val:
            max_val = val
    return max_val


# A simplisitic implementation which will just take the domininant land coverage
# type for each cell as the one with the highest cumulative percentage.
# This has the large downside that coverage types which only every show up as
# non-dominant will never be used and thus under-representative
def dominant_coverage_type_from_max_percentage(
        total_percentages: CumulativeLandCoverageTypePercentages,
        sorted_cells: list[H3Cell],
        region: Region
    ):
    unused_percentages: CumulativeLandCoverageTypePercentages = {t: 0 for t in TYPES}
    used_percentages: CumulativeLandCoverageTypePercentages = {t: 0 for t in TYPES}

    # Build list of dominant coverage records and accumulate unused percentages
    dominant_cells: list[H3CellDominantLandCoverage] = []
    for cell in sorted_cells:
        perc_map = cell.simplified_coverage_type_cumulative_percentages
        if not perc_map:
            raise ValueError(f"Cell {cell.h3_cell_id} has no coverage type percentages")

        # Find dominant type for this cell
        dominant_type = max(perc_map.keys(), key=lambda k: perc_map[k])
        dominant_percentage = perc_map[dominant_type]

        dominant_cells.append(
            H3CellDominantLandCoverage(
                h3_cell_id=cell.h3_cell_id,
                dominant_simplified_coverage_type=dominant_type,
                dominant_simplified_coverage_type_percentage=dominant_percentage,
            )
        )

        used_percentages[dominant_type] += dominant_percentage

        # Add the non-dominant percentages to the unused accumulator
        for t, v in perc_map.items():
            if t == dominant_type:
                continue
            unused_percentages[t] = unused_percentages.get(t, 0) + int(v)

    assess_usage(total_percentages, used_percentages, unused_percentages, region)
    return dominant_cells


def assess_usage(total_percentages, used_percentages, unused_percentages, region):
    print("total_percentages", total_percentages)
    print("used_percentages", used_percentages)
    print("unused_percentages", unused_percentages)

    # used + unused should equal total for each type
    for t in TYPES:
        total = total_percentages[t]
        used = used_percentages[t]
        unused = unused_percentages[t]
        if total != round(used + unused):
            raise ValueError(f"Type {t} in region {region.name} has total {total} != used + unused {round(used + unused)}")

    # Plot a bar chart of the total, used, and unused percentages for each type
    x = np.arange(len(TYPES))
    total_vals = [total_percentages[t] for t in TYPES]
    used_vals = [used_percentages[t] for t in TYPES]
    unused_vals = [unused_percentages[t] for t in TYPES]
    width = 0.25
    plt.bar(x - width, total_vals, width=width, label="Total")
    plt.bar(x, used_vals, width=width, label="Used")
    plt.bar(x + width, unused_vals, width=width, label="Unused")
    plt.xticks(x, TYPES, rotation=45)
    plt.ylabel("Percentage")
    plt.title(f"Land Coverage Percentages for Region {region.name}")
    plt.legend()
    plt.tight_layout()
    plt.show()


def save_dominant_land_coverage_data_for_region(region_name: str, dominant_cells: list[H3CellDominantLandCoverage]):
    # Save results for the region
    out = [asdict(h3_cell) for h3_cell in dominant_cells]
    with open(output_file_path.format(region_name=region_name), "w") as f:
        json.dump(out, f, indent=2)


def load_dominant_land_coverage_data_for_region(region_name: str) -> dict[str, H3CellDominantLandCoverage]:
    with open(output_file_path.format(region_name=region_name), "r") as f:
        data = json.load(f)
    return {
        cell_data["h3_cell_id"]: H3CellDominantLandCoverage(**cell_data)
        for cell_data in data
    }


if __name__ == "__main__":
    process()
