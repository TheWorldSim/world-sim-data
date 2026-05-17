import ipdb
import pandas as pd


from constants import (
    field_id,
    field_technology_type,
    field_development_status,
    field_installed_capacity,
    field_operational_date,

    field_RO_banding,
    field_FiT_tariff,
    field_CfD_capacity,

    field_turbine_capacity,
    field_number_of_turbines,
    field_height_of_turbines,

    new_field_lon_coord,
    new_field_lat_coord,

    technology_types,
    development_status_to_include,
)
from files_names import output_file_path


def process_wind_df(wind_df: pd.DataFrame) -> None:
    print(f"Processing wind data of {len(wind_df)} rows")

    # # Count the number of rows which have a value that is not null in the following fields:
    # for field in [field_RO_banding, field_FiT_tariff, field_CfD_capacity]:
    #     num_rows_with_value = wind_df[wind_df[field].notnull()]
    #     print(f"Number of rows with {field} value: {len(num_rows_with_value)}")
    #     print(f"e.g. values: {num_rows_with_value[field].unique()[:10]}")

    # # Take one row and print out the column names and values to understand the data structure
    # for column in wind_df.columns:
    #     print(f"{column}: {wind_df.iloc[0][column]}")

    offshore = wind_df[wind_df[field_technology_type] == technology_types["wind_offshore"]]
    onshore = wind_df[wind_df[field_technology_type] == technology_types["wind_onshore"]]

    save_to_csv(offshore, "wind_offshore")
    save_to_csv(onshore, "wind_onshore")
    bucket_by_year(offshore, "wind_offshore")
    bucket_by_year(onshore, "wind_onshore")


def save_to_csv(df: pd.DataFrame, name: str):
    df = df.copy()
    calculated_capacity = df[field_turbine_capacity] * df[field_number_of_turbines]

    # Find rows where the difference between the installed capacity and
    # calculated capacity is more than 10%
    find_large_diffs = False
    if find_large_diffs:
        df = df.copy() # avoid SettingWithCopyWarning when adding the new column

        new_field_calculated_capacity = "calculated_capacity"
        df[new_field_calculated_capacity] = calculated_capacity

        # Filter out rows where no field_installed_capacity or calculated_capacity
        big_diff = df[df[field_installed_capacity].notnull() & df[new_field_calculated_capacity].notnull()]

        diff = big_diff[field_installed_capacity] - big_diff[new_field_calculated_capacity]
        diff_ratio = abs(diff) / big_diff[new_field_calculated_capacity]
        big_diff = big_diff.copy()
        big_diff["diff_ratio"] = diff_ratio

        big_diff = big_diff[
            (big_diff["diff_ratio"] > 0.1)
            & (big_diff[field_installed_capacity] > 50)
        ]
        if len(big_diff):
            print(big_diff[[field_installed_capacity, new_field_calculated_capacity, "diff_ratio"]])


    subset_df = df[[
        field_id,
        field_development_status,
        field_installed_capacity,
        field_operational_date,

        field_turbine_capacity,
        field_number_of_turbines,
        field_height_of_turbines,

        new_field_lon_coord,
        new_field_lat_coord,
        # new_field_area,
    ]].copy()

    file_path = output_file_path(name)
    subset_df.to_csv(file_path, index=False)
    print(f"Output written to: {file_path}")


def bucket_by_year(df: pd.DataFrame, name: str):
    df = df.copy()
    df["year"] = df[field_operational_date].dt.year

    # Count the number of wind farms that became operational each year
    df_rows_by_year = df.groupby("year")
    # Total installed capacity by year
    capacity_by_year = df_rows_by_year[field_installed_capacity].sum().round(1)
    # area_by_year = df_rows_by_year[new_field_area].sum()

    # Make a new dataframe with the results
    yearly_df = pd.DataFrame({
        "year": capacity_by_year.index.astype(int).values,
        "number of wind farms": df_rows_by_year.size().values,
        "total installed capacity (MWelec)": capacity_by_year.values,

        "total number of turbines": df_rows_by_year[field_number_of_turbines].sum().values.astype(int),

        # "total area (km^2)": (pd.to_numeric(area_by_year) / 1e6).round(1).values,
        # "average area (m^2)": (pd.to_numeric(area_by_year) / df_rows_by_year.size()).astype(int).values,
        # "max area (m^2)": df_rows_by_year[new_field_area].max().astype(int).values,
    })

    file_path = output_file_path(name + "_yearly")
    yearly_df.to_csv(file_path, index=False)
    print(f"Yearly output written to: {file_path}")
