import os

import ipdb
import numpy as np
import pandas as pd
import pyproj

from constants import (
    field_technology_type,
    field_installed_capacity,
    field_solar_site_area,
    field_development_status,

    field_operational_date,
    field_x_coord,
    field_y_coord,

    new_field_lon_coord,
    new_field_lat_coord,

    technology_types,
    development_status_to_include,
)
from files_names import input_file_path
from solar.process import process_solar_df
from wind.process import process_wind_df



def process_data():
    df = pd.read_csv(input_file_path, encoding="utf-8-sig", low_memory=False, parse_dates=True)

    # Used for development and debugging
    # df = df.head(100)

    df = clean_data(df)

    # Filter down to only those entries with a development status in the specified list.
    df = df[df[field_development_status].isin(development_status_to_include)]

    solar_df = df[df[field_technology_type] == technology_types["PV"]].copy()
    # Used for development and debugging
    # solar_df = solar_df.head(100)
    process_solar_df(solar_df)

    wind_df = df[
        (df[field_technology_type] == technology_types["wind_offshore"])
        | (df[field_technology_type] == technology_types["wind_onshore"])
    ].copy()
    # Used for development and debugging
    # wind_df = wind_df.head(100)
    process_wind_df(wind_df)


def clean_data(df: pd.DataFrame) -> pd.DataFrame:
    # parse_dates=True does not seem to work with the "Operational" column, so parse it manually
    df[field_operational_date] = df[field_operational_date].map(parse_date)

    # Remove newlines in string columns like the "Address" field.  Makes it easier
    # to work with the data.
    df["Address"] = df["Address"].str.replace("\r\n", ", ").replace("\n", ", ").replace("\r", ", ")
    df = df.map(lambda x: x.replace("\r\n", " ").replace("\n", " ").replace("\r", " ") if isinstance(x, str) else x)

    # Convert numeric fields as float or integer depending on the data in them.
    df[field_installed_capacity] = pd.to_numeric(df[field_installed_capacity], errors="coerce")
    df[field_solar_site_area] = pd.to_numeric(df[field_solar_site_area], errors="coerce", downcast="integer")

    # parse integer values in X-coordinate and Y-coordinate with bad values in
    # them like "431746�"
    df[field_x_coord] = pd.to_numeric(df[field_x_coord].replace({r"[^\d.]": ""}, regex=True), downcast="integer")
    df[field_y_coord] = pd.to_numeric(df[field_y_coord].replace({r"[^\d.]": ""}, regex=True), downcast="integer")

    # Use pyproj.Transformer for fast, vectorized coordinate transformation
    transformer = pyproj.Transformer.from_crs("EPSG:27700", "EPSG:4326", always_xy=True)
    x = df[field_x_coord].values
    y = df[field_y_coord].values
    lon: np.ndarray
    lat: np.ndarray
    lon, lat = transformer.transform(x, y)
    # Round to 3 decimal places https://xkcd.com/2170/
    df[new_field_lon_coord] = lon.round(3)
    df[new_field_lat_coord] = lat.round(3)

    return df


def parse_date(date_str):
    if pd.isna(date_str):
        return pd.NaT
    for fmt in ("%d/%m/%Y", "%d.%m.%Y"):
        try:
            return pd.to_datetime(date_str, format=fmt)
        except ValueError:
            continue
    # If all formats fail, return NaT
    return pd.NaT


if __name__ == "__main__":
    process_data()
