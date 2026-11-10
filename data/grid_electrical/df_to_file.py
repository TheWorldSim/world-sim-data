from pathlib import Path

import pandas as pd


def save_buses_df(buses_fields: pd.DataFrame, path: Path):
    bus_fields = ["bus_id", "voltage", "lon", "lat"]
    buses_fields[bus_fields].to_csv(path, index=False)


def save_lines_df(lines_df: pd.DataFrame, path: Path):
    line_fields = ["line_id", "bus0", "bus1", "voltage", "s_nom", "x_pu", "geometry"]
    lines_df[line_fields].to_csv(path, index=False, float_format="%.15g")


def save_links_df(links_df: pd.DataFrame, path: Path):
    link_fields = ["link_id", "bus0", "bus1", "voltage", "p_nom", "geometry"]
    links_df[link_fields].to_csv(path, index=False, float_format="%.15g")
