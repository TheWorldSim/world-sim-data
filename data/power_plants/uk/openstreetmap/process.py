#!/usr/bin/env python3
"""
Analyze an OSM XML file and print element attributes and, for each
`<tag k=... v=.../>`, the top-N most common values.

Placed here to be run as the module `process` for this dataset.
"""

import argparse
import csv
import gzip
import ipdb
import os
import sys
import re
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict
from typing import Dict, Optional

import geopandas as gpd
from shapely.geometry import Polygon
from matplotlib import pyplot as plt

current_directory = os.path.dirname(os.path.abspath(__file__))
src_directory = os.path.abspath(current_directory + "/../../../../src")
data_directory = os.path.abspath(current_directory + "/../../../../data")
for path in [src_directory, data_directory]:
    if path not in sys.path:
        sys.path.append(path)

from boundaries.eez.process import get_UK_EEZ
from boundaries.countries.process import get_boundaries


def review_data(top_n: int = 20):
    """Parse the OSM XML and print summaries.

    If `xml_path` is not provided the function will look for `data.xml`
    in the same directory as this script.
    """

    attr_counters: Dict[str, Counter] = defaultdict(Counter)
    tag_values: Dict[str, Counter] = defaultdict(Counter)

    for row in open_data_file_and_yield_rows():
        tag, elem = row
        # print(f"tag: {tag}, elem: {elem.tag}, attrib: {elem.attrib}")
        if tag == "tag":
            k = elem.attrib.get("k")
            v = elem.attrib.get("v", "")

            # print(f"tag: {k} = {v}")

            if k:
                tag_values[k][v] += 1
        else:
            for a, v in elem.attrib.items():
                attr_counters[a][v] += 1

    # Print element attribute summaries
    print("Element attributes and top values:")
    if not attr_counters:
        print("  (no element attributes found)")
    for attr, counter in sorted(attr_counters.items(), key=lambda kv: -sum(kv[1].values())):
        total = sum(counter.values())
        print(f"\nAttribute: {attr} (seen {total} times, {len(counter)} unique values)")
        for val, cnt in counter.most_common(top_n):
            print(f"  {cnt:8d}  {val}")

    # Print tag key -> value summaries
    print("\nTag keys and top values:")
    if not tag_values:
        print("  (no <tag k=... v=.../> elements found)")
    for k, counter in sorted(tag_values.items(), key=lambda kv: -sum(kv[1].values())):
        total = sum(counter.values())
        print(f"\nTag key: {k} (seen {total} times, {len(counter)} unique values)")
        for val, cnt in counter.most_common(top_n):
            print(f"  {cnt:8d}  {val}")


def _review_data():
    p = argparse.ArgumentParser(description="Summarise OSM XML tag values and element attributes")
    p.add_argument("file", nargs="?", default=None, help="Path to OSM XML file (default: data.xml next to this script)")
    p.add_argument("--top", "-n", type=int, default=20, help="Top N values to show per attribute/key")
    args = p.parse_args()
    review_data(args.top)



keys = [
    "name",
    # "name:en",

    "lat",
    "lon",

    "plant:source",
    # "generator:source",
    # "plant:method",
    # "generator:method",

    "plant:output:electricity",
    "plant:storage",

    # "start_date",
    # "year_of_construction",

    # "postal_code",
    # "addr:postcode",
]

def process():
    rows = []
    current_row = {}

    for row in open_data_file_and_yield_rows():
        tag, elem = row
        # print(f"tag: {tag}, elem: {elem.tag}, attrib: {elem.attrib}")
        if tag == "node" or tag == "tag" or tag == "way" or tag == "center":
            for k, v in elem.attrib.items():
                if k in keys:
                    current_row[k] = v

            k = elem.attrib.get("k")
            v = elem.attrib.get("v", "")
            # print(f"tag: {k} = {v}")

            if k in keys:
                current_row[k] = v

        if tag == "node" or tag == "way":
            if current_row:
                # print(current_row)
                rows.append(current_row)
                current_row = {}

    rows = filter_to_uk(rows, False)
    rows = filter_out_incomplete_rows(rows)

    write_rows_to_csv(rows, "power_plants_uk.csv")

    gas_plants = extract_gas_power_plants(rows)
    hydro_plants = extract_hydro_power_plants(rows)
    batteries = extract_batteries(rows)
    write_rows_to_csv(gas_plants, "power_plants_uk_gas.csv")
    write_rows_to_csv(hydro_plants, "power_plants_uk_hydro.csv")
    write_rows_to_csv(batteries, "power_plants_uk_batteries.csv")

    plot_plants(gas_plants, "purple", "Gas Power Plants")
    plot_plants(hydro_plants, "blue", "Hydro Power Plants")
    plot_plants(batteries, "grey", "Battery")
    plt.legend()
    plt.show()


def filter_to_uk(rows: list[dict], plot_power_plants_in_or_out_of_uk: bool):
    uk_eez_data = get_UK_EEZ()
    uk_eez_polygon = Polygon(uk_eez_data.joined.union_all().coords)
    country_boundaries = get_boundaries()
    uk_multipolygon = country_boundaries.uk_mainland.union(country_boundaries.ni)

    # Plot the UK EEZ polygon(s) and the points for visual verification
    plt.figure(figsize=(10, 10))
    x, y = uk_eez_polygon.exterior.xy
    plt.plot(x, y, color="blue", label="UK EEZ Boundary")
    x, y = country_boundaries.uk_mainland.exterior.xy
    plt.plot(x, y, color="green", label="UK")
    x, y = country_boundaries.ni.exterior.xy
    plt.plot(x, y, color="green", label="UK")


    def is_in_uk(row):
        lat = float(row.get("lat", 0))
        lon = float(row.get("lon", 0))
        point = gpd.points_from_xy([lon], [lat])[0]
        return uk_multipolygon.contains(point)

    have_set_legend_for_in_uk = False
    have_set_legend_for_out_of_uk = False
    filtered_rows = []
    for row in rows:
        in_uk = is_in_uk(row)
        if in_uk:
            filtered_rows.append(row)

        if plot_power_plants_in_or_out_of_uk:
            lat = float(row.get("lat", 0))
            lon = float(row.get("lon", 0))
            # If in UK, plot in green; otherwise, plot in red
            label = "In UK" if in_uk else "Out of UK"
            if in_uk:
                if have_set_legend_for_in_uk:
                    label = None
                have_set_legend_for_in_uk = True
            else:
                if have_set_legend_for_out_of_uk:
                    label = None
                have_set_legend_for_out_of_uk = True
            plt.scatter(lon, lat, color="green" if in_uk else "red", s=10, alpha=0.5, label=label)

    return filtered_rows


required_keys = [
    # "name",
    "lat",
    "lon",
    "plant:source",
    "plant:output:electricity",
]
def filter_out_incomplete_rows(rows: list[dict]):
    filtered_rows = []
    for row in rows:
        insert_row = all(row.get(k) for k in required_keys)

        if insert_row:
            parsed_MW = parse_megawatts(row.get("plant:output:electricity"))
            row["plant:output:electricity"] = parsed_MW
            if not parsed_MW:
                insert_row = False

        parsed_wattage = parse_storage(row.get("plant:storage"))
        row["plant:storage"] = parsed_wattage

        if insert_row:
            if is_battery(row) and not row.get("plant:storage"):
                insert_row = False

        if insert_row:
            filtered_rows.append(row)
    print(f"Filtered out {len(rows) - len(filtered_rows)} incomplete rows.")
    return filtered_rows


def parse_megawatts(wattage_str: Optional[str]):
    if not wattage_str:
        return None

    wattage_str = wattage_str.strip().lower()

    if wattage_str == "yes":
        return None

    # Use regular expression to match digits and optional decimal point, followed by optional whitespace and some string (like "MW", "kW", "W")
    regex = r"^~?(?P<number>[\d]+(?:\.[\d]+)?)\s*(?P<units>mw|mwp|mva|kw|kwp|kwwp)$"
    match = re.match(regex, wattage_str)

    if not match:
        # print(f"Could not parse wattage string: {wattage_str}")
        return None

    units = match.group("units")
    factor = 1 if units.startswith("mw") else 0.001
    return float(match.group("number")) * factor


def parse_storage(storage_str: Optional[str]):
    if not storage_str:
        return None

    storage_str = storage_str.strip().lower()

    # Use regular expression to match digits and optional decimal point, followed by optional whitespace and some string (like "MW", "kW", "Wh", "MWh", "kWh")
    regex = r"^~?(?P<number>[\d]+(?:\.[\d]+)?)\s*(?P<units>gwh|mwh)$"
    match = re.match(regex, storage_str)

    if not match:
        # print(f"Could not parse storage string: {storage_str}")
        return False

    units = match.group("units")
    factor = 1 if units.startswith("mwh") else 1000 if units.startswith("gwh") else 0.001
    return float(match.group("number")) * factor


def write_rows_to_csv(rows: list[dict], filename: str):
    if not rows:
        print("No rows to write to CSV.")
        return

    file_path = os.path.join(os.path.dirname(__file__), filename)
    with open(file_path, "w", newline="", encoding="utf-8") as output_file:
        dict_writer = csv.DictWriter(output_file, fieldnames=keys)
        dict_writer.writeheader()
        dict_writer.writerows(rows)


def plot_plants(rows: list[dict], color, plant_type):
    for i, row in enumerate(rows):
        lat = float(row.get("lat", 0))
        lon = float(row.get("lon", 0))
        label = plant_type if i == 0 else None
        plt.scatter(lon, lat, color=color, s=10, alpha=0.5, label=label)


def extract_gas_power_plants(rows):
    gas_power_plants = []
    for row in rows:
        if row.get("plant:source") == "gas": #or row.get("generator:source") == "gas":
            gas_power_plants.append(row)

    print(f"Found {len(gas_power_plants)} gas power plants.")
    return gas_power_plants


def extract_hydro_power_plants(rows):
    hydro_power_plants = []
    for row in rows:
        if row.get("plant:source") == "hydro": #or row.get("generator:source") == "hydro":
            hydro_power_plants.append(row)

    print(f"Found {len(hydro_power_plants)} hydro power plants.")
    return hydro_power_plants


def is_battery(row: dict):
    return row.get("plant:source") == "battery" #or row.get("generator:storage") == "battery"


def extract_batteries(rows):
    batteries = []
    for row in rows:
        if is_battery(row):
            batteries.append(row)

    print(f"Found {len(batteries)} batteries.")
    return batteries


def open_data_file_and_yield_rows():
    here = os.path.dirname(__file__)
    xml_path = os.path.join(here, "data.xml")

    if not os.path.exists(xml_path):
        print(f"OSM XML file not found: {xml_path}")
        return

    opener = gzip.open if xml_path.endswith(".gz") else open

    try:
        with opener(xml_path, "rb") as fh:
            for event, elem in ET.iterparse(fh, events=("end",)):
                tag = _local_name(elem.tag)

                yield tag, elem

                elem.clear()
    except ET.ParseError as e:
        print(f"XML parse error while parsing {xml_path}: {e}")
        return


def _local_name(tag: str) -> str:
    return tag.split("}", 1)[-1] if "}" in tag else tag


if __name__ == "__main__":
    # _review_data()
    process()
