import math
import os

import ipdb
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

    new_field_power_density_initial,
    new_field_power_density_3,
    new_field_predicted_area,
    new_field_area,
    new_field_lon_coord,
    new_field_lat_coord,

    technology_types,
    development_status_to_include,
)
from solar.apply_solar_farm_model import apply_solar_farm_model
from solar.files import ouput_intermeditate_file_path, output_file_path
from solar.get_average_solar_farm_power_density import (
    get_solar_farm_power_to_area_model,
    set_new_field_power_density_initial,
)
from solar.graph_solar_outliers import graph_solar_outliers


current_directory = os.path.dirname(os.path.abspath(__file__))
data_directory = os.path.join(current_directory, "data")
input_file_path = os.path.join(data_directory, "REPD_publication_Q1_2026.csv")



def process_data():
    df = pd.read_csv(input_file_path, encoding="utf-8-sig", low_memory=False, parse_dates=True)

    # Used for development and debugging
    # df = df.head(100)

    df = clean_data(df)

    # Filter down to only those entries with a development status in the specified list.
    df = df[df[field_development_status].isin(development_status_to_include)]

    # Step 1: initial power density where both capacity and area are present and > 0
    # Convert columns to numeric in-place for safe math operations
    df[field_installed_capacity] = pd.to_numeric(df[field_installed_capacity], errors="coerce")
    df[field_solar_site_area] = pd.to_numeric(df[field_solar_site_area], errors="coerce")

    solar_df = df[df[field_technology_type] == technology_types["PV"]].copy()
    # Used for development and debugging
    # solar_df = solar_df.head(100)

    set_new_field_power_density_initial(solar_df)
    solar_farm_power_to_area_model = get_solar_farm_power_to_area_model(solar_df)
    apply_solar_farm_model(solar_df, solar_farm_power_to_area_model)

    # graph_solar_outliers(solar_df, solar_farm_power_to_area_model)

    # Write full Solar PV intermediate file
    solar_output_file_name = ouput_intermeditate_file_path("solar")
    solar_df.to_csv(solar_output_file_name, index=False)
    print(f"Intermediate written to: {solar_output_file_name}")

    filter_solar_df(solar_df)


def clean_data(df):
    # parse_dates=True does not seem to work with the "Operational" column, so parse it manually
    df[field_operational_date] = df[field_operational_date].map(parse_date)

    # Remove newlines in string columns like the "Address" field.  Makes it easier
    # to work with the data.
    df["Address"] = df["Address"].str.replace("\r\n", ", ").replace("\n", ", ").replace("\r", ", ")
    df = df.map(lambda x: x.replace("\r\n", " ").replace("\n", " ").replace("\r", " ") if isinstance(x, str) else x)

    # parse integer values in X-coordinate and Y-coordinate with bad values in
    # them like "431746�"
    df[field_x_coord] = pd.to_numeric(df[field_x_coord].replace({r"[^\d.]": ""}, regex=True), downcast="integer")
    df[field_y_coord] = pd.to_numeric(df[field_y_coord].replace({r"[^\d.]": ""}, regex=True), downcast="integer")

    # Use pyproj.Transformer for fast, vectorized coordinate transformation
    transformer = pyproj.Transformer.from_crs("EPSG:27700", "EPSG:4326", always_xy=True)
    x = df[field_x_coord].values
    y = df[field_y_coord].values
    lon, lat = transformer.transform(x, y)
    df[new_field_lon_coord] = lon
    df[new_field_lat_coord] = lat

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


def filter_solar_df(df):
    filtered_df = df[[
        field_development_status,
        # field_technology_type,
        field_installed_capacity,
        field_operational_date,
        # field_x_coord,
        # field_y_coord,
        new_field_lon_coord,
        new_field_lat_coord,

        # new_field_predicted_area,
        new_field_area,
    ]].copy()

    filtered_df.to_csv(output_file_path("solar"), index=False)
    print(f"Output written to: {output_file_path("solar")}")


if __name__ == "__main__":
    process_data()
