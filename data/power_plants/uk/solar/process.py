import ipdb
import pandas as pd

from constants import (
    field_installed_capacity,
    field_development_status,
    field_operational_date,

    new_field_area,
    new_field_lon_coord,
    new_field_lat_coord,
)
from apply_solar_farm_model import apply_solar_farm_model
from files import ouput_intermeditate_file_path, output_file_path
from get_average_solar_farm_power_density import (
    get_solar_farm_power_to_area_model,
    set_new_field_power_density_initial,
)
from graph_solar_outliers import graph_solar_outliers


def process_solar_df(solar_df: pd.DataFrame):
    set_new_field_power_density_initial(solar_df)
    solar_farm_power_to_area_model = get_solar_farm_power_to_area_model(solar_df)
    apply_solar_farm_model(solar_df, solar_farm_power_to_area_model)

    # graph_solar_outliers(solar_df, solar_farm_power_to_area_model)

    # Write full Solar PV intermediate file
    solar_output_file_name = ouput_intermeditate_file_path("solar")
    solar_df.to_csv(solar_output_file_name, index=False)
    print(f"Intermediate written to: {solar_output_file_name}")

    filter_solar_df(solar_df)


def filter_solar_df(df):
    filtered_df = df[[
        field_development_status,
        field_installed_capacity,
        field_operational_date,

        new_field_lon_coord,
        new_field_lat_coord,
        new_field_area,
    ]].copy()

    filtered_df.to_csv(output_file_path("solar"), index=False)
    print(f"Output written to: {output_file_path("solar")}")
