from dataclasses import dataclass
import math

import ipdb
from pathlib import Path
import os
import sys

import geopandas as gpd
import matplotlib.pyplot as plt
import matplotlib as mpl
import pandas as pd
from shapely import Polygon


current_directory = Path(__file__).resolve().parent
src_directory = (current_directory.parent.parent / "src").as_posix()
data_directory = (current_directory.parent.parent / "data").as_posix()
for path in [src_directory, data_directory]:
    if path not in sys.path:
        sys.path.append(path)


from boundaries.countries.process import get_boundaries


uk_land_polygons = get_boundaries().uk_all


def process():
    fig, ax = plt.subplots(figsize=(12, 12))
    add_land_to_plot(ax, uk_land_polygons)
    plot_transmission(ax)
    plt.title("UK High-voltage Transmission: cables, lines, interconnectors")
    plt.show()


def add_land_to_plot(ax, land_polygons: list[Polygon]):
    land_gdf = gpd.GeoDataFrame(geometry=land_polygons)
    land_gdf.plot(ax=ax, color="gray")


def _read_layer(path):
    if not os.path.exists(path):
        raise FileNotFoundError(f"File not found: {path}")
    return gpd.read_file(path)


def plot_transmission(ax):
    base = os.path.join(current_directory, "uk", "out")

    # don't plot towers (pylons) per user request

    # cables (including buried and submarine)
    cables_file_path = os.path.join(base, "britain-and-ireland_cable.geojson")
    lines_file_path = os.path.join(base, "britain-and-ireland_line.geojson")
    cables = _read_layer(cables_file_path)
    lines = _read_layer(lines_file_path)

    cables = normalise_values(cables)
    cables = filter_rows(cables)
    lines = normalise_values(lines)
    lines = filter_rows(lines)

    cables_and_lines = gpd.GeoDataFrame(pd.concat([cables, lines], ignore_index=True))
    # plot_lines_and_cables_voltages(ax, cables_and_lines)
    plot_lines_and_cables_count(ax, cables_and_lines)


def normalise_values(rows):
    def float_not_nan(value):
        value = float(value)
        if isinstance(value, float) and math.isnan(value):
            return None
        return value

    # try to interpret voltage as numeric where present
    def parse_float(value):
        try:
            if value is None:
                return None
            if isinstance(value, (int, float)):
                return float_not_nan(value)
            string = str(value)
            # some values are like "132000;33000"
            if ";" in string:
                string = string.split(";")[0]
            return float_not_nan(string)
        except Exception:
            return None

    def parse_int(value):
        parsed = parse_float(value)
        return None if parsed is None else int(parsed)

    rows["voltage_v"] = rows["tags.voltage"].apply(parse_float)
    rows["cables"] = rows["tags.cables"].apply(parse_int)
    rows["circuits"] = rows["tags.circuits"].apply(parse_int)

    return rows


def filter_rows(rows):
    rows = rows[rows["voltage_v"].notnull() & (rows["voltage_v"] >= 100000)]
    rows = rows[rows.geometry.notnull()]
    return rows


def plot_lines_and_cables_voltages(ax, cables_and_lines):
    # Plot discrete voltage categories instead of a continuous colour scale.
    # Map each unique voltage to a distinct colour and draw a legend entry for it.
    unique_voltages = bucket_voltages(cables_and_lines['voltage_v'].unique(), 10)

    # Use a single continuous colormap (e.g. 'viridis') sampled across the number of buckets
    n_buckets = len(unique_voltages.all_buckets)

    # use a red->orange->blue diverging palette
    cmap = mpl.cm.get_cmap('tab20', n_buckets)
    cmap = mpl.cm.get_cmap('viridis', n_buckets)
    cmap = mpl.cm.get_cmap('plasma', n_buckets)
    colours = [cmap(i) for i in range(n_buckets)]
    colour_map = {i: colours[i] for i in range(n_buckets)}

    for i, bucket in enumerate(unique_voltages.all_buckets):
        # select rows whose numeric voltage falls within the bucket range
        part = cables_and_lines[(cables_and_lines['voltage_v'] >= bucket.min_voltage) & (cables_and_lines['voltage_v'] <= bucket.max_voltage)]
        if part.empty:
            continue
        label = f"{int(bucket.min_voltage // 1000)}-{int(bucket.max_voltage // 1000)} kV" if bucket.min_voltage != 0 else "unknown"
        part.plot(ax=ax, color=colour_map[i], linewidth=0.8, label=label)

    # Create a legend showing the discrete voltage categories
    ax.legend(title='Voltage')


def plot_lines_and_cables_count(ax, cables_and_lines):
    # Keep only rows with a positive integer cables value
    cables_and_lines = cables_and_lines[cables_and_lines['cables'].notnull() & (cables_and_lines['cables'] > 0)]
    cables_and_lines['cables'] = cables_and_lines['cables'].astype(int)

    # Define a mapping from original cable counts to four groups (1, 3, 6, others)
    # Group ids: 1 -> single cable, 2 -> three cables, 3 -> six cables, 4 -> grouped others
    original_to_group = {
        1: 1,
        3: 2,
        6: 4,

        2: 3,
        4: 3,
        5: 3,
        7: 3,
        8: 3,
        9: 3,
        12: 3,
        15: 3,
    }

    # Apply mapping to create a new column `cable_groups`.
    # Unknown counts (not in the mapping) will be placed in group 4 (others).
    cables_and_lines['cable_groups'] = cables_and_lines['cables'].apply(lambda c: original_to_group.get(int(c), 3))

    # Labels for the four groups (order corresponds to group ids 1..4)
    group_labels = {
        1: '1 cable',
        2: '3 cables',
        4: '6 cables',
        3: '2,4,5,7,8,9,12,15 cables (others)',
    }

    # Prepare colours for the four groups
    unique_group_ids = [1, 2, 3, 4]
    cmap = mpl.cm.get_cmap('plasma', len(unique_group_ids))
    colours = {gid: cmap(i) for i, gid in enumerate(unique_group_ids)}

    # Plot each group once so the legend contains only four entries
    for gid in unique_group_ids:
        part = cables_and_lines[cables_and_lines['cable_groups'] == gid]
        if part.empty:
            continue
        part.plot(ax=ax, color=colours[gid], linewidth=0.8, label=group_labels[gid])

    ax.legend(title='Cables')


@dataclass
class VoltageBucket:
    min_voltage: float
    max_voltage: float

@dataclass
class VoltageBuckets:
    min_voltage: float
    max_voltage: float
    all_buckets: list[VoltageBucket]
    voltage_to_bucket: dict[float, VoltageBucket]

def bucket_voltages(voltages: list[float], percent_difference) -> VoltageBuckets:
    voltages = sorted(voltages)

    # Bucket voltages into nearest +10% e.g. if voltages are 30, 40, 200, 210
    # then the resulting buckets would be 30, 40, 200-210
    buckets = VoltageBuckets(min_voltage=float("inf"), max_voltage=float("-inf"), all_buckets=[], voltage_to_bucket={})
    for v in voltages:
        # Find the nearest bucket within 10% range
        bucket_found = False
        for bucket in buckets.all_buckets:
            if bucket.min_voltage <= v <= bucket.max_voltage:
                buckets.voltage_to_bucket[v] = bucket
                bucket_found = True
                break

        if bucket_found:
            continue
        # Create a new bucket for this voltage
        new_bucket = VoltageBucket(min_voltage=v, max_voltage=v * (1 + percent_difference / 100))
        buckets.all_buckets.append(new_bucket)
        buckets.voltage_to_bucket[v] = new_bucket
        buckets.min_voltage = min(buckets.min_voltage, new_bucket.min_voltage)
        buckets.max_voltage = max(buckets.max_voltage, new_bucket.max_voltage)

    return buckets


if __name__ == "__main__":
    process()
