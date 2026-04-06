# Data from: https://www.kaggle.com/datasets/tomfarnell/national-grid-energy-consumption-2009-2025
# Note that this data is missing some interconnector data such as:
#   * Nemo interconnector
#   * North Sea Link interconnector
#   * ElecLink interconnector
#   * Viking interconnector
#   * Greenlink interconnector
#  See NESO: https://www.neso.energy/data-portal/historic-demand-data/historic_demand_data_2026


from datetime import datetime
import os

# Install dependencies as needed:
# pip install kagglehub[pandas-datasets]
import kagglehub
from kagglehub import KaggleDatasetAdapter
import pandas as pd

directory_of_this_file = os.path.dirname(os.path.abspath(__file__))

# Set the path to the file you'd like to load
file_path = "National Grid Data 2009-2025_noNaN.csv"

# Load the latest version
df = kagglehub.dataset_load(
  KaggleDatasetAdapter.PANDAS,
  "tomfarnell/national-grid-energy-consumption-2009-2025",
  file_path,
  # Provide any additional arguments like
  # sql_query or pandas_kwargs. See the
  # documenation for more information:
  # https://github.com/Kaggle/kagglehub/blob/main/README.md#kaggledatasetadapterpandas
)


# Discard the first 2 rows of the df and use the 3rd row as the header
df = df.iloc[2:].reset_index(drop=True)
df.columns = df.iloc[0]  # Set the 3rd row as the header
df = df[1:].reset_index(drop=True)  # Remove the row that is now the header


def parse_custom_date(date_str):
    for fmt in ("%d/%m/%Y", "%d-%b-%y"):
        try:
            return datetime.strptime(date_str, fmt)
        except (ValueError, TypeError):
            continue
    return None  # or raise an error if you prefer

df["SETTLEMENT_DATE"] = df["SETTLEMENT_DATE"].apply(parse_custom_date)
df["SETTLEMENT_PERIOD"] = pd.to_numeric(df["SETTLEMENT_PERIOD"], errors="coerce")

# Print out the minimum and maximum values for the "SETTLEMENT_DATE" column
min_date = df["SETTLEMENT_DATE"].min()
max_date = df["SETTLEMENT_DATE"].max()
print(f"\nMinimum SETTLEMENT_DATE: {min_date}")
print(f"Maximum SETTLEMENT_DATE: {max_date}")


# Order the DataFrame by the "SETTLEMENT_DATE" column in ascending order
df = df.sort_values(by=["SETTLEMENT_DATE", "SETTLEMENT_PERIOD"]).reset_index(drop=True)

print("\nDataFrame after cleaning and sorting...\nFirst settlement date: ", df["SETTLEMENT_DATE"].iloc[0])
print("Last settlement date:  ", df["SETTLEMENT_DATE"].iloc[-1])

# Save the cleaned DataFrame to a new CSV file
output_file_path = directory_of_this_file + "/cleaned_national_grid_energy_consumption.csv"
df.to_csv(output_file_path, index=False)
print(f"\nCleaned data saved to {output_file_path}")
