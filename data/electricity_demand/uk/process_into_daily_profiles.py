from dataclasses import dataclass
import json
import os
import re

import pandas as pd
import matplotlib.pyplot as plt

directory_of_this_file = os.path.dirname(os.path.abspath(__file__))


# Load the CSV file
file_path = directory_of_this_file + "/cleaned_national_grid_energy_consumption.csv"
df = pd.read_csv(file_path)
df["SETTLEMENT_DATE"] = pd.to_datetime(df["SETTLEMENT_DATE"], errors="coerce")

# Print column names
print("Column names in the DataFrame:")
print("\n".join(list(df.columns)), "\n")

# Get one year of data where the "SETTLEMENT_DATE" is between "2009-01-01" and "2009-12-31"
# We do not use 2009 because the TSD data contains 0 values for the "low_demand" day
early_year_str = "2010"  # "2009"
df_early_year = df[(df["SETTLEMENT_DATE"] >= f"{early_year_str}-01-01") & (df["SETTLEMENT_DATE"] <= f"{early_year_str}-12-31")]
df_recent_year = df[(df["SETTLEMENT_DATE"] >= "2024-01-01") & (df["SETTLEMENT_DATE"] <= "2024-12-31")]

# Plot the "ND" and "TSD" columns against the "SETTLEMENT_DATE" column
def plot_nd_tsd_over_time(df):
    fig = plt.figure(figsize=(12, 6))
    plt.plot(df["SETTLEMENT_DATE"], df["ND"], label="ND", color="blue")
    plt.plot(df["SETTLEMENT_DATE"], df["TSD"], label="TSD", color="orange")
    plt.xlabel("Settlement Date")
    plt.ylabel("Energy Consumption")
    plt.title("ND and TSD over Time")
    plt.legend()
    plt.xticks(rotation=45)
    plt.tight_layout()
    plt.show()


# plot_nd_tsd_over_time(df_early_year)
# plot_nd_tsd_over_time(df_recent_year)


# tsd_2009_max_index = df_early_year["TSD"].idxmax()
# tsd_2024_max_index = df_recent_year["TSD"].idxmax()
# print("Get index of max TSD in 2009: \n", df_early_year[["ND", "TSD"]].loc[tsd_2009_max_index], " at index: ", tsd_2009_max_index, " ")
# print("Get index of max TSD in 2024: \n", df_recent_year[["ND", "TSD"]].loc[tsd_2024_max_index], " at index: ", tsd_2024_max_index, " ")
# print("")


def get_columns_of_interest(df: pd.DataFrame) -> pd.DataFrame:
    return df[["SETTLEMENT_PERIOD", "ND", "TSD"]]


@dataclass
class DailyProfile:
    data: pd.DataFrame
    date_str: str | None

    @staticmethod
    def from_df(df: pd.DataFrame) -> "DailyProfile":
        return DailyProfile(get_columns_of_interest(df), df["SETTLEMENT_DATE"].iloc[0].strftime("%Y-%m-%d"))


@dataclass
class DailyProfiles:
    year: int
    low_demand: DailyProfile
    average_demand: DailyProfile
    high_demand: DailyProfile


def assert_data_is_for_same_day(df: pd.DataFrame):
    unique_dates = df["SETTLEMENT_DATE"].unique()
    if not len(unique_dates) == 1:
        raise ValueError("Expected all settlement dates in df to be the same but got: ", unique_dates)


def get_max_nd_for_day(df: pd.DataFrame) -> float:
    return df["ND"].max()


def make_daily_profiles(df: pd.DataFrame) -> DailyProfiles:
    # Day 0
    day_0_date = df.iloc[0]["SETTLEMENT_DATE"]
    day_0 = df[df["SETTLEMENT_DATE"] == day_0_date]
    i = len(day_0)

    # Double check that all the ["SETTLEMENT_DATE"] values in day_0 are the same
    assert_data_is_for_same_day(day_0)

    lowest_nd_daily_max = highest_nd_daily_max = get_max_nd_for_day(day_0)

    low_demand = DailyProfile.from_df(day_0)
    average_demand_data = [get_columns_of_interest(day_0)]
    high_demand = DailyProfile.from_df(day_0)

    # Go through each day in the DataFrame and find the maximum ND value for that day
    while i < len(df):
        next_day_date = df.iloc[i]["SETTLEMENT_DATE"]
        day = df[df["SETTLEMENT_DATE"] == next_day_date]
        assert_data_is_for_same_day(day)

        daily_max_nd = get_max_nd_for_day(day)

        if daily_max_nd < lowest_nd_daily_max:
            low_demand = DailyProfile.from_df(day)
            lowest_nd_daily_max = daily_max_nd
        elif daily_max_nd > highest_nd_daily_max:
            high_demand = DailyProfile.from_df(day)
            highest_nd_daily_max = daily_max_nd

        average_demand_data.append(get_columns_of_interest(day))

        i += len(day)


    # Average the ND and TSD columns in average_demand_data by the "SETTLEMENT_PERIOD" column
    average_demand_df = pd.concat(average_demand_data).groupby("SETTLEMENT_PERIOD").mean().reset_index()
    # Drop the last two rows which are from the single "clocks go backwards" day in October
    average_demand_df = average_demand_df[:-2]
    # Set the "SETTLEMENT_PERIOD", "ND" and "TSD" columns to be integers instead of floats
    average_demand_df["SETTLEMENT_PERIOD"] = average_demand_df["SETTLEMENT_PERIOD"].astype(int)
    average_demand_df["ND"] = average_demand_df["ND"].astype(int)
    average_demand_df["TSD"] = average_demand_df["TSD"].astype(int)

    average_demand = DailyProfile(average_demand_df, None)


    year = day_0_date.year

    return DailyProfiles(year, low_demand, average_demand, high_demand)


daily_profiles_2009 = make_daily_profiles(df_early_year)
daily_profiles_2024 = make_daily_profiles(df_recent_year)


# Plot the low, average and high demand profiles for 2009 and 2024
def plot_daily_profiles(daily_profiles: DailyProfiles, title: str):
    fig = plt.figure(figsize=(12, 6))
    plt.plot(daily_profiles.low_demand.data["SETTLEMENT_PERIOD"] / 2 - 0.5, daily_profiles.low_demand.data["ND"], label=f"Low Demand {daily_profiles.low_demand.date_str}", color="blue")
    plt.plot(daily_profiles.average_demand.data["SETTLEMENT_PERIOD"] / 2 - 0.5, daily_profiles.average_demand.data["ND"], label="Average Demand", color="orange")
    plt.plot(daily_profiles.high_demand.data["SETTLEMENT_PERIOD"] / 2 - 0.5, daily_profiles.high_demand.data["ND"], label=f"High Demand {daily_profiles.high_demand.date_str}", color="red")
    plt.xlabel("Settlement Period")
    plt.ylabel("Energy Consumption (ND)")
    plt.title(title)
    plt.legend()
    plt.xticks(rotation=45)
    plt.tight_layout()
    plt.show()

# plot_daily_profiles(daily_profiles_2009, "Daily Profiles for 2009")
# plot_daily_profiles(daily_profiles_2024, "Daily Profiles for 2024")


def save_daily_profiles_to_json(daily_profiles: list[DailyProfiles], directory: str):
    # Save the data as:
    # {
    #     "2009": {
    #         "low_demand": {
    #            "date_str": "2009-01-01",
    #            "data": [
    #                ["SETTLEMENT_PERIOD", "ND", "TSD"],
    #                [1, 1000, 900],
    #                [2, 1100, 950],
    #                ...
    #         },
    #         "average_demand": average_demand_data,
    #         "high_demand": high_demand_data,
    #     },
    #     "2024": { ... } }

    columns = ["SETTLEMENT_PERIOD", "ND", "TSD"]

    data = {}
    for daily_profile in daily_profiles:
        data[daily_profile.year] = {
            "low_demand": {
                "date_str": daily_profile.low_demand.date_str,
                "data": columns + daily_profile.low_demand.data.values.tolist(),
            },
            "average_demand": {
                "date_str": None,
                "data": columns + daily_profile.average_demand.data.values.tolist(),
            },
            "high_demand": {
                "date_str": daily_profile.high_demand.date_str,
                "data": columns + daily_profile.high_demand.data.values.tolist(),
            },
        }

    with open(directory + "/daily_profiles.json", "w") as f:
        data_str = json.dumps(data)
        data_str = data_str.replace('}, "average_demand"', '},\n"average_demand"')
        data_str = data_str.replace('}, "high_demand"', '},\n"high_demand"')
        data_str = re.sub(r'\}, "(\d+)"', r'},\n"\1"', data_str)
        f.write(data_str)

    print(f"Daily profiles saved to {directory}/daily_profiles.json")


save_daily_profiles_to_json([daily_profiles_2009, daily_profiles_2024], directory_of_this_file)
