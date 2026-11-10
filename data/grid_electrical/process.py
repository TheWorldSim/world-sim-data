from pathlib import Path

import numpy as np
import pandas as pd
import shapely as shp
from df_to_file import save_buses_df, save_lines_df, save_links_df
from process_uk import process_uk
from pyproj import Geod

GEOD = Geod(ellps="WGS84")

LATLON_DP = 3
LATLON_MIN_DISTANCE_M = 2000
VALUE_SF = 3

cwd = Path.cwd()
buses_input_path = cwd / "input/eur/buses.csv"
lines_input_path = cwd / "input/eur/lines.csv"
links_input_path = cwd / "input/eur/links.csv"
uk_eez_path = Path("/Users/ajp/projects/the_world_sim/world-sim-data/data/boundaries/eez/uk_eez.geojson")
eur_buses_processed_path = cwd / "processed/eur/buses.csv"
eur_lines_processed_path = cwd / "processed/eur/lines.csv"
eur_links_processed_path = cwd / "processed/eur/links.csv"


def process():
    eur_buses_df = process_buses()
    bus_df_by_old_id = eur_buses_df.set_index("old_bus_id", drop=False)

    eur_lines_df = process_lines(bus_df_by_old_id)
    eur_links_df = process_links(bus_df_by_old_id)

    process_uk(eur_lines_df, eur_links_df, eur_buses_df)


def process_buses():
    bus_df = pd.read_csv(buses_input_path)
    bus_df["old_bus_id"] = bus_df["bus_id"]
    bus_df["bus_id"] = range(len(bus_df))

    # Limit decimal places for lat lon
    bus_df["lon"] = bus_df["x"].astype(float).round(LATLON_DP)
    bus_df["lat"] = bus_df["y"].astype(float).round(LATLON_DP)

    save_buses_df(bus_df, eur_buses_processed_path)

    return bus_df


def process_lines(bus_df_by_old_id: pd.DataFrame):
    lines_df = pd.read_csv(lines_input_path, quotechar="'")

    # Manually repair data
    lines_df.loc[lines_df["line_id"] == "way/1302963591-220", "geometry"] = "LINESTRING (-3.57961068 40.41199437, -3.57500309 40.42231781, -3.571702949526109 40.41176072465484, -3.5716714 40.4117619, -3.5674641 40.4119189, -3.5657976 40.4119763, -3.5654965848212576 40.41198789978665)".replace("-3.57961068 40.41199437, ", "")

    # Copied from: https://github.com/PyPSA/PyPSA/blob/9f0b8a7/pypsa/network/power_flow.py#L814-L816
    lines_df["x_pu"] = lines_df["x"] / (lines_df["voltage"] ** 2)

    lines_df["voltage"] = round_sig_figs(lines_df["voltage"], VALUE_SF)
    lines_df["s_nom"] = round_sig_figs(lines_df["s_nom"], VALUE_SF)
    lines_df["x_pu"] = round_sig_figs(lines_df["x_pu"], VALUE_SF)

    lines_df["geometry"] = round_linestring_series(lines_df, bus_df_by_old_id, LATLON_DP)

    map_line_id = {orig_id: new_id for new_id, orig_id in enumerate(lines_df["line_id"])}
    lines_df["line_id"] = lines_df["line_id"].map(map_line_id)
    lines_df["bus0"] = lines_df["bus0"].map(lambda old_bus_id: bus_df_by_old_id.at[old_bus_id, "bus_id"])
    lines_df["bus1"] = lines_df["bus1"].map(lambda old_bus_id: bus_df_by_old_id.at[old_bus_id, "bus_id"])

    save_lines_df(lines_df, eur_lines_processed_path)

    return lines_df


def process_links(bus_df_by_old_id: pd.DataFrame):
    links_df = pd.read_csv(links_input_path, quotechar="'")

    links_df["voltage"] = round_sig_figs(links_df["voltage"], VALUE_SF)
    links_df["p_nom"] = round_sig_figs(links_df["p_nom"], VALUE_SF)

    links_df["geometry"] = round_linestring_series(links_df, bus_df_by_old_id, LATLON_DP)

    map_link_id = {orig_id: new_id for new_id, orig_id in enumerate(links_df["link_id"])}
    links_df["link_id"] = links_df["link_id"].map(map_link_id)
    links_df["bus0"] = links_df["bus0"].map(lambda old_bus_id: bus_df_by_old_id.at[old_bus_id, "bus_id"])
    links_df["bus1"] = links_df["bus1"].map(lambda old_bus_id: bus_df_by_old_id.at[old_bus_id, "bus_id"])

    save_links_df(links_df, eur_links_processed_path)

    return links_df


def round_sig_figs(series: pd.Series, sig_figs: int) -> pd.Series:
    values = series.astype(float)
    # Zeros, NaNs and infinities are left unchanged
    mask = np.isfinite(values) & (values != 0)
    # Replace masked-out values with 1.0 so log10 never sees 0, NaN or inf
    exponent = np.floor(np.log10(np.abs(values.where(mask, 1.0))))
    factor = 10.0 ** (sig_figs - 1 - exponent)
    rounded = np.round(values * factor) / factor
    return rounded.where(mask, values) # type: ignore


def round_linestring_series(df: pd.DataFrame, bus_df_by_old_id: pd.DataFrame, dp: int = LATLON_DP) -> pd.Series:
    return df.apply(
        lambda row: round_linestring(row, dp, bus_df_by_old_id)
        if pd.notna(row["geometry"]) else row["geometry"],
        axis=1,
    )


def round_linestring(row: pd.Series, dp: int, bus_df_by_old_id: pd.DataFrame) -> str:
    line = shp.from_wkt(row["geometry"])
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

    # Some geometries start at the location of bus1 instead of bus0, if so, swap
    # the direction.  Will fix over 2000 lines & links
    if len(kept_coords) > 1:
        bus0 = bus_df_by_old_id.loc[row["bus0"]]
        bus0_coords = bus0[["lon", "lat"]].to_numpy()
        if np.array_equal(kept_coords[0], bus0_coords):
            pass
        else:
            # Check that the reverse values match
            bus1 = bus_df_by_old_id.loc[row["bus1"]]
            bus1_coords = bus1[["lon", "lat"]]
            if np.array_equal(kept_coords[-1], bus0_coords) and np.array_equal(kept_coords[0], bus1_coords):
                # print(f"Reversing line {row.get("line_id", row.get("link_id"))}")
                kept_coords = kept_coords[::-1]
            else:
                raise ValueError(f"Line {row.get("line_id", row.get("link_id"))} geometry does not start or end at the expected bus coordinates: {row["bus0"]}, {row["bus1"]}")

    if len(kept_coords) == 1:
        rounded = shp.points(kept_coords)
    else:
        rounded = shp.linestrings(kept_coords)
    # rounding_precision=-1 stops shapely truncating coordinates to 6 dp on output
    return shp.to_wkt(rounded, rounding_precision=-1) # type: ignore


if __name__ == "__main__":
    process()
