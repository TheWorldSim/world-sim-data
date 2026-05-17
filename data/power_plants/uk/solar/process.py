import ipdb
import pandas as pd

from constants import (
    field_id,
    field_installed_capacity,
    field_development_status,
    field_operational_date,

    new_field_area,
    new_field_lon_coord,
    new_field_lat_coord,
)
from apply_solar_farm_model import apply_solar_farm_model
from files_names import ouput_intermeditate_file_path, output_file_path
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

    save_to_csv(solar_df)

    bucket_by_year(solar_df)


def save_to_csv(df):
    subset_df = df[[
        field_id,
        field_development_status,
        field_installed_capacity,
        field_operational_date,

        new_field_lon_coord,
        new_field_lat_coord,
        new_field_area,
    ]].copy()

    subset_df.to_csv(output_file_path("solar"), index=False)
    print(f"Output written to: {output_file_path("solar")}")


def bucket_by_year(df: pd.DataFrame):
    df["year"] = df[field_operational_date].dt.year

    # Count the number of solar farms that became operational each year
    solar_farms_by_year = df.groupby("year")
    # Total installed capacity by year
    capacity_by_year = solar_farms_by_year[field_installed_capacity].sum().round(1)
    area_by_year = solar_farms_by_year[new_field_area].sum()

    # Make a new dataframe with the results
    yearly_df = pd.DataFrame({
        "year": capacity_by_year.index.astype(int).values,
        "number of solar farms": solar_farms_by_year.size().values,
        "total installed capacity (MWelec)": capacity_by_year.values,
        "total area (km^2)": (pd.to_numeric(area_by_year) / 1e6).round(1).values,
        "average area (m^2)": (pd.to_numeric(area_by_year) / solar_farms_by_year.size()).astype(int).values,
        "max area (m^2)": solar_farms_by_year[new_field_area].max().astype(int).values,
    })

    file_path = output_file_path("solar_yearly")
    yearly_df.to_csv(file_path, index=False)
    print(f"Yearly output written to: {file_path}")
