import sys
from pathlib import Path

import pandas as pd
from shapely.geometry import Point, Polygon

this_dir = Path(__file__).parent
data_dir = this_dir / ".."
if data_dir not in sys.path:
    sys.path.append(str(data_dir))

from boundaries.eez.load_uk_eez import load_uk_eez
from df_to_file import save_buses_df, save_lines_df, save_links_df
from process_to_h3 import aggregate_grid_to_h3

processed_uk_dir = this_dir / "processed/uk"
uk_buses_processed_path = processed_uk_dir / "buses.csv"
uk_lines_processed_path = processed_uk_dir / "lines.csv"
uk_links_processed_path = processed_uk_dir / "links.csv"
processed_uk_h3_dir = processed_uk_dir / "h3r4"


def process_uk(eur_lines_df: pd.DataFrame, eur_links_df: pd.DataFrame, eur_buses_df: pd.DataFrame):
    # Load UK EEZ boundary
    uk_eez_polygon = load_uk_eez()
    # Process UK-specific data filtered by EEZ
    uk_buses_df = process_uk_buses(eur_buses_df, uk_eez_polygon)

    uk_bus_ids = set(uk_buses_df["bus_id"])
    (related_bus_ids, uk_lines_df) = process_uk_lines(uk_bus_ids, eur_lines_df)
    links_result = process_uk_links(uk_bus_ids, eur_links_df)
    uk_links_df = links_result[1]
    related_bus_ids = related_bus_ids.union(links_result[0])

    all_uk_related_bus_ids = uk_bus_ids.union(related_bus_ids)
    all_uk_related_buses = eur_buses_df[eur_buses_df["bus_id"].isin(all_uk_related_bus_ids)]
    save_buses_df(all_uk_related_buses, uk_buses_processed_path)

    aggregate_grid_to_h3(all_uk_related_buses, uk_lines_df, uk_links_df, processed_uk_h3_dir)


def is_point_in_eez(lon: float, lat: float, eez_polygon: Polygon) -> bool:
    """Check if a point (lon, lat) is inside the EEZ polygon."""
    point = Point(lon, lat)
    return eez_polygon.contains(point)


def process_uk_buses(eur_bus_df: pd.DataFrame, uk_eez_polygon: Polygon):
    # Filter buses to only those inside the UK EEZ
    mask = eur_bus_df.apply(
        lambda row: is_point_in_eez(row["lon"], row["lat"], uk_eez_polygon), axis=1
    )
    # # Plot the lat lon of the uk_eez_polygon
    # import matplotlib.pyplot as plt
    # x, y = uk_eez_polygon.exterior.xy
    # plt.plot(x, y, label="UK EEZ")
    # plt.scatter(eur_bus_df["lon"], eur_bus_df["lat"], c=mask, cmap="coolwarm", label="Buses")
    # plt.xlabel("Longitude")
    # plt.ylabel("Latitude")
    # plt.legend()
    # plt.show()

    uk_buses_df = eur_bus_df[mask]
    return uk_buses_df


def process_uk_lines(uk_bus_ids: set[str], eur_lines_df: pd.DataFrame):
    uk_lines_df = eur_lines_df[eur_lines_df["bus0"].isin(uk_bus_ids) | eur_lines_df["bus1"].isin(uk_bus_ids)]

    save_lines_df(uk_lines_df, uk_lines_processed_path)

    # Return the bus IDs that are connected to the UK EEZ
    related_bus_ids = set(uk_lines_df["bus0"]).union(set(uk_lines_df["bus1"])) - uk_bus_ids

    return (related_bus_ids, uk_lines_df)


def process_uk_links(uk_bus_ids: set[str], eur_links_df: pd.DataFrame):
    uk_links_df = eur_links_df[eur_links_df["bus0"].isin(uk_bus_ids) | eur_links_df["bus1"].isin(uk_bus_ids)]

    save_links_df(uk_links_df, uk_links_processed_path)

    # Return the bus IDs that are connected to the UK EEZ
    related_bus_ids = set(uk_links_df["bus0"]).union(set(uk_links_df["bus1"])) - uk_bus_ids
    return (related_bus_ids, uk_links_df)
    return (related_bus_ids, uk_links_df)
    return (related_bus_ids, uk_links_df)
