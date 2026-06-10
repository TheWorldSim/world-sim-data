from dataclasses import dataclass
from io import StringIO
import json
from typing import Generator, Literal


import ipdb
import os
import sys

import pandas as pd


current_directory = os.path.dirname(os.path.abspath(__file__))
data_directory = os.path.join(current_directory, "input_data/uk_eez")
year = 2019
expected_date_from = f"{year}-01-01"
solar_output_path = os.path.join(current_directory, f"../solarpv_capacity/data/_{year}_uk_h3_res4.csv")
wind_output_path = os.path.join(current_directory, f"../wind_turbine_capacity/data/_{year}_uk_h3_res4.csv")


type DataType = Literal["wind", "solar"]
@dataclass
class CSVData:
    h3_cell_id: str
    csv_content: str


def process():
    process_data_type("solar", solar_output_path)
    process_data_type("wind", wind_output_path)


def process_data_type(data_type: DataType, output_path: str):
    csvs = get_CSVs(data_type)
    csv_count = 0

    a_csv = next(csvs)
    result = get_initial_dataframe(a_csv.csv_content)
    df = result["new_df"]
    header = result["header"]

    csvs = get_CSVs(data_type)
    while True:
        try:
            csv = next(csvs)
        except StopIteration:
            break
        csv_count += 1
        df = process_csv(csv, df)

    # Save the processed DataFrame to a CSV file
    with open(output_path, "w", newline="") as f:
        f.write(header + "\n")
        df.to_csv(f, index=False)

    print(f"Processed {csv_count} {data_type} CSVs and saved the result to {output_path}")


def get_initial_dataframe(csv_content: str):
    csv_lines = csv_content.split("\n")

    date_from = json.loads(csv_lines[2].replace("# ", ""))["params"]["date_from"]
    # check date_from is expected_date_from
    if date_from != expected_date_from:
        raise ValueError(f"Unexpected date_from value: {date_from}.  Expected \"{expected_date_from}\".")

    df = pd.read_csv(StringIO(csv_content), comment="#")

    new_df = pd.DataFrame()
    new_df["time"] = df["time"]

    header = "\n".join([
        csv_lines[0],
        csv_lines[1],
        "# Example of the parameters returned from the API which were used to generate one of the CSV files which has been used to form this CSV:",
        csv_lines[2],
    ])

    return {"new_df": new_df, "header": header}


def get_CSVs(data_type: DataType) -> Generator[CSVData]:
    file_names = sorted(os.listdir(data_directory))

    for file_name in file_names:
        if not file_name.endswith(".csv"):
            continue

        type_of_data = "wind" if "wind" in file_name else ("solar" if "solar" in file_name else None)
        if type_of_data is None:
            raise ValueError(f"Unexpected file name format: \"{file_name}\".  Expected to contain either \"wind\" or \"solar\".")

        if type_of_data != data_type:
            continue

        h3_cell_id = file_name.split("_")[-1].split(".")[0]

        full_path = os.path.join(data_directory, file_name)
        with open(full_path, "r") as f:
            csv_content = f.read()

        yield CSVData(
            h3_cell_id=h3_cell_id,
            csv_content=csv_content
        )


def process_csv(csv: CSVData, df: pd.DataFrame):
    print("Processing CSV for H3 cell ID:", csv.h3_cell_id)
    df1 = pd.read_csv(StringIO(csv.csv_content), comment="#")
    df[csv.h3_cell_id] = round(df1["electricity"] * 100).astype(int)
    df = df.copy()  # Silences warning "DataFrame is highly fragmented"
    return df


if __name__ == "__main__":
    process()
