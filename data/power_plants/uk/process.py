import math
import os

import ipdb
import pandas as pd

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
    new_field_area,

    technology_types,
    development_status_to_include,
)
from get_average_solar_farm_power_density import (
    get_average_solar_farm_power_density,
    set_new_field_power_density_initial,
)
from apply_solar_farm_model import apply_solar_farm_model


current_directory = os.path.dirname(os.path.abspath(__file__))
input_file_path = os.path.join(current_directory, "REPD_publication_Q1_2026.csv")
# Useful for debugging and sanity checking
ouput_intermeditate_file_path = os.path.join(current_directory, "intermediate_REPD_publication_Q1_2026.csv")
ouput_file_path = os.path.join(current_directory, "processed_REPD_publication_Q1_2026.csv")



def process_data():
    df = pd.read_csv(input_file_path, encoding="utf-8-sig", low_memory=False, parse_dates=True)
    # parse_dates=True does not seem to work with the "Operational" column, so parse it manually
    df[field_operational_date] = df[[field_operational_date]].apply(lambda v: pd.to_datetime(v, dayfirst=True))
    ipdb.set_trace()
    # Remove newlines in string columns like the "Address" field.  Makes it easier
    # to work with the data.
    df["Address"] = df["Address"].str.replace("\r\n", ", ").replace("\n", ", ").replace("\r", ", ")
    df = df.map(lambda x: x.replace("\r\n", " ").replace("\n", " ").replace("\r", " ") if isinstance(x, str) else x)

    # Filter down to only those entries with a development status in the specified list.
    df = df[df[field_development_status].isin(development_status_to_include)]

    # Step 1: initial power density where both capacity and area are present and > 0
    # Convert columns to numeric in-place for safe math operations
    df[field_installed_capacity] = pd.to_numeric(df[field_installed_capacity], errors="coerce")
    df[field_solar_site_area] = pd.to_numeric(df[field_solar_site_area], errors="coerce")

    set_new_field_power_density_initial(df)
    solar_farm_power_density_model = get_average_solar_farm_power_density(df)
    apply_solar_farm_model(df, solar_farm_power_density_model)






    # Step 2: average over valid Solar PV initial densities only
    solar_mask = df[field_technology_type] == technology_types["PV"]
    # solar_valid = df.loc[solar_mask, new_field_power_density_initial].dropna()
    # solar_valid = solar_valid[solar_valid > 0]
    # avg_density = solar_valid.mean()
    # min_density = solar_valid.min()

    # lower_bound = 0.05 * min_density
    # upper_bound = 0.50 * avg_density

    # # Step 3: flag True/False for Solar PV rows only; null for all other rows
    # d = df[new_field_power_density_initial]
    # in_range = d.notna() & (d > lower_bound) & (d < upper_bound)
    # df[new_field_power_density_2] = pd.NA
    # df.loc[solar_mask, new_field_power_density_2] = in_range[solar_mask]

    # # Step 4: filtered average over Solar PV rows with flag == True
    # filtered = df.loc[solar_mask & df[new_field_power_density_2].eq(True), new_field_power_density_initial]
    # new_avg_density = filtered.mean() if not filtered.empty else avg_density

    # # Step 5: corrected power density for Solar PV rows
    # use_original = solar_mask & df[new_field_power_density_2].eq(True)
    # use_average = solar_mask & ~df[new_field_power_density_2].eq(True)
    # df[new_field_power_density_3] = pd.NA
    # df.loc[use_original, new_field_power_density_3] = df.loc[use_original, new_field_power_density_initial]
    # df.loc[use_average, new_field_power_density_3] = new_avg_density

    # # Step 6: area derived from corrected power density
    # corrected_density = pd.to_numeric(df[new_field_power_density_3], errors="coerce")
    # df[new_field_area] = (capacity * 1_000_000 / corrected_density).where(corrected_density > 0)

    # Write full Solar PV intermediate file
    solar_df = df[solar_mask].copy()
    solar_df.to_csv(ouput_intermeditate_file_path, index=False)
    print(f"Intermediate written to: {ouput_intermeditate_file_path}")

    # print(f"Processed {solar_mask.sum()} Solar PV rows.")
    # print(f"Initial avg power density (all valid): {avg_density:.2f} W/sqm")
    # print(f"Bounds: lower={lower_bound:.2f}, upper={upper_bound:.2f} W/sqm")
    # print(f"Filtered avg power density (valid range Solar PV): {new_avg_density:.2f} W/sqm")

    filter_df(solar_df)


def filter_df(df):
    filtered_df = df[[
        field_development_status,
        # field_technology_type,
        field_installed_capacity,
        # new_field_area,
        field_operational_date,
        field_x_coord,
        field_y_coord,
    ]].copy()
    # filtered_df[new_field_area] = filtered_df[new_field_area].round(0)
    filtered_df.to_csv(ouput_file_path, index=False)
    print(f"Output written to: {ouput_file_path}")


if __name__ == "__main__":
    process_data()
