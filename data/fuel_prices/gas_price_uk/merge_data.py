import os

import pandas as pd
import numpy as np


current_dir = os.path.dirname(os.path.abspath(__file__))

input_file_name_ons = current_dir + "/ons_gas_price.csv"
input_file_name_te = current_dir + "/trading_economics.csv"
output_file_name = current_dir + "/merged_gas_price.csv"


df_ons = pd.read_csv(input_file_name_ons)
df_te = pd.read_csv(input_file_name_te)

df_ons["date"] = pd.to_datetime(df_ons["Date"])
del df_ons["Date"]
df_te["date"] = pd.to_datetime(df_te["date"])#.dt.date

# Check that the first date in trading_economics is "2016-03-21"
start_date_te = df_te["date"].min()
assert start_date_te == pd.to_datetime("2016-03-21")#.date()

# The ONS data is per day.
# The trading_economics data has a value for each week
# We want to have the average price from the ONS data for each week in the trading_economics data.
# I do not know if the trading_economics data is for the week ending on the date,
# or the week starting on the date, or mid week. I will assume it is for the week ending on the date.

def custom_match(ons_date):
    # Example: find the latest df_te["date"] that is <= ons_date
    # Or implement any custom comparison you want
    candidates = df_te[ons_date <= df_te["date"]]
    if not candidates.empty:
        return candidates["date"].min()
    else:
        return pd.NaT

df_ons["date"] = df_ons["date"].apply(custom_match)

result = df_ons.groupby("date")["SAP actual day"].agg(
    SAP_average="mean",
    SAP_sd="std"
).reset_index()


def round_sig(x, sig=3):
    return round(x, sig - int(np.floor(np.log10(abs(x))) + 1)) if pd.notnull(x) and x != 0 else x


# Round to 3 significant figures
result["SAP_average"] = result["SAP_average"].apply(round_sig)
result["SAP_sd"] = result["SAP_sd"].apply(lambda x: round_sig(x, 2))

# Merge the ONS data with the trading_economics data on the "date" column,
# keeping all rows from the trading_economics data
result2 = pd.merge(result, df_te, on="date", how="right")

# Save the result2 to a new CSV file
result2.to_csv(output_file_name, index=False)
