from pathlib import Path

import numpy as np
import pandas as pd
from pyproj import Geod
import shapely as shp

GEOD = Geod(ellps="WGS84")

LATLON_DP = 3
LATLON_MIN_DISTANCE_M = 2000
VALUE_SF = 3

cwd = Path().cwd()
buses_input_path = cwd / "eur/input/buses.csv"
lines_input_path = cwd / "eur/input/lines.csv"
links_input_path = cwd / "eur/input/links.csv"
buses_processed_path = cwd / "eur/processed/buses.csv"
lines_processed_path = cwd / "eur/processed/lines.csv"
links_processed_path = cwd / "eur/processed/links.csv"


def process():
    map_bus_id = process_buses()
    process_lines(map_bus_id)
    process_links(map_bus_id)


def process_buses():
    bus_df = pd.read_csv(buses_input_path)
    map_bus_id = {orig_id: new_id for new_id, orig_id in enumerate(bus_df["bus_id"])}
    bus_df["bus_id"] = bus_df["bus_id"].map(map_bus_id)
    # Limit decimal places for lat lon
    bus_df["lon"] = bus_df["x"].astype(float).round(LATLON_DP)
    bus_df["lat"] = bus_df["y"].astype(float).round(LATLON_DP)
    bus_fields = ["bus_id", "voltage", "lon", "lat"]
    bus_df = bus_df[bus_fields]
    bus_df.to_csv(buses_processed_path, index=False)

    return map_bus_id


def process_lines(map_bus_id):
    line_df = pd.read_csv(lines_input_path, quotechar="'")

    map_line_id = {orig_id: new_id for new_id, orig_id in enumerate(line_df["line_id"])}
    line_df["line_id"] = line_df["line_id"].map(map_line_id)
    line_df["bus0"] = line_df["bus0"].map(map_bus_id)
    line_df["bus1"] = line_df["bus1"].map(map_bus_id)

    # Copied from: https://github.com/PyPSA/PyPSA/blob/9f0b8a7/pypsa/network/power_flow.py#L814-L816
    line_df["x_pu"] = line_df["x"] / (line_df["voltage"] ** 2)

    line_df["voltage"] = round_sig_figs(line_df["voltage"], VALUE_SF)
    line_df["s_nom"] = round_sig_figs(line_df["s_nom"], VALUE_SF)
    line_df["x_pu"] = round_sig_figs(line_df["x_pu"], VALUE_SF)

    line_df["geometry"] = round_linestring_series(line_df["geometry"], LATLON_DP)

    line_fields = ["line_id", "bus0", "bus1", "voltage", "s_nom", "x_pu", "geometry"]
    line_df = line_df[line_fields]
    line_df.to_csv(lines_processed_path, index=False, float_format="%.15g")


def process_links(map_bus_id):
    link_df = pd.read_csv(links_input_path, quotechar="'")

    map_link_id = {orig_id: new_id for new_id, orig_id in enumerate(link_df["link_id"])}
    link_df["link_id"] = link_df["link_id"].map(map_link_id)
    link_df["bus0"] = link_df["bus0"].map(map_bus_id)
    link_df["bus1"] = link_df["bus1"].map(map_bus_id)

    link_df["voltage"] = round_sig_figs(link_df["voltage"], VALUE_SF)
    link_df["p_nom"] = round_sig_figs(link_df["p_nom"], VALUE_SF)

    link_df["geometry"] = round_linestring_series(link_df["geometry"], LATLON_DP)

    link_fields = ["link_id", "bus0", "bus1", "voltage", "p_nom", "geometry"]
    link_df = link_df[link_fields]
    link_df.to_csv(links_processed_path, index=False, float_format="%.15g")


def round_sig_figs(series: pd.Series, sig_figs: int) -> pd.Series:
    values = series.astype(float)
    # Zeros, NaNs and infinities are left unchanged
    mask = np.isfinite(values) & (values != 0)
    # Replace masked-out values with 1.0 so log10 never sees 0, NaN or inf
    exponent = np.floor(np.log10(np.abs(values.where(mask, 1.0))))
    factor = 10.0 ** (sig_figs - 1 - exponent)
    rounded = np.round(values * factor) / factor
    return rounded.where(mask, values) # type: ignore


def round_linestring_series(series: pd.Series, dp: int = LATLON_DP) -> pd.Series:
    return series.map(lambda str_value: round_linestring(str_value, dp) if pd.notna(str_value) else str_value)


def round_linestring(str_value: str, dp: int) -> str:
    line = shp.from_wkt(str_value)
    coords = np.round(shp.get_coordinates(line), dp)
    # Keep a point only if it differs from the previous point after rounding
    keep = np.concatenate(([True], np.any(np.diff(coords, axis=0) != 0, axis=1)))
    kept_coords = coords[keep]

    # If the kept coordinates are too close to each other, keep only the first one
    # and the very last in the list
    if len(kept_coords) > 1:
        lons = kept_coords[:, 0]
        lats = kept_coords[:, 1]
        _, _, distances_m = GEOD.inv(lons[:-1], lats[:-1], lons[1:], lats[1:])
        if np.all(np.asarray(distances_m) < LATLON_MIN_DISTANCE_M):
            kept_coords = np.array([kept_coords[0], kept_coords[-1]])

    if len(kept_coords) == 1:
        rounded = shp.points(kept_coords)
    else:
        rounded = shp.linestrings(kept_coords)
    # rounding_precision=-1 stops shapely truncating coordinates to 6 dp on output
    return shp.to_wkt(rounded, rounding_precision=-1) # type: ignore


if __name__ == "__main__":
    process()
