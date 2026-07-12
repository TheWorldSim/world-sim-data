# This file is used to populate the ./input_data/uk_eez directory with files like:
# wind_h3_res_4_cell_8419757ffffffff.csv from the renewables.ninja API

import os
import sys
import time
from typing import Literal

import requests

current_directory = os.path.dirname(os.path.abspath(__file__))
src_directory = os.path.abspath(current_directory + "/../../src")
data_directory = os.path.abspath(current_directory + "/../../data")
for path in [src_directory, data_directory]:
    if path not in sys.path:
        sys.path.append(path)


from data.dgg.process_h3 import H3CellData, load_h3_cells
from constants import H3_RESOLUTION

directory_for_data = os.path.abspath(current_directory + "/input_data/uk_eez")
renewable_ninja_solar_api = "https://www.renewables.ninja/api/data/pv?local_time=true&format=csv&header=true&lat={lat}&lon={lon}&date_from=2019-01-01&date_to=2019-12-31&dataset=merra2&capacity=1&system_loss=0.1&tracking=0&tilt=35&azim=180&raw=false"
renewable_ninja_wind_api = "https://www.renewables.ninja/api/data/wind?local_time=true&format=csv&header=true&lat={lat}&lon={lon}&date_from=2019-01-01&date_to=2019-12-31&dataset=merra2&capacity=1&height=80&turbine=Vestas+V90+2000&raw=false"


def log(message: str):
    print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {message}", flush=True)


cookie = ""
def get_cookie():
    global cookie
    if cookie:
        return cookie

    try:
        with open(os.path.join(current_directory, ".env.renewables_ninja_cookie.txt"), "r") as f:
            cookie = f.read().strip()
    except FileNotFoundError:
        log("Cookie file not found. Please create a .env.renewables_ninja_cookie.txt file, then sign into Renewables.Ninja, make a request and copy the cookie sent in the header.")

    return cookie


def fetch_all_data():
    h3_cells = load_h3_cells()
    for cell in h3_cells:
        fetch_and_save_data_for_cell(cell, "solar")
        fetch_and_save_data_for_cell(cell, "wind")


type DataType = Literal["wind", "solar"]
def fetch_and_save_data_for_cell(cell: H3CellData, data_type: DataType):
    log(f"Processing cell {cell.h3_cell_id} for {data_type} data...")
    if have_data_for_cell(cell, data_type):
        log(f"{data_type} data for cell {cell.h3_cell_id} already exists. Skipping.")
        return

    if data_type == "solar" and not cell.has_some_land:
        log(f"Cell {cell.h3_cell_id} is not land, skipping solar data fetch.")
        return

    url = (renewable_ninja_wind_api if data_type == "wind" else renewable_ninja_solar_api).format(lat=cell.lat, lon=cell.lon)
    fetch_data_for_cell_exponential_backoff(cell, url, data_type)


def have_data_for_cell(cell: H3CellData, data_type: DataType) -> bool:
    existing_data_files = set(os.listdir(directory_for_data))
    expected_filename = filename_for_cell(cell, data_type)
    return expected_filename in existing_data_files


def fetch_data_for_cell_exponential_backoff(cell: H3CellData, url: str, data_type: DataType, max_retries: int = 5) -> None:
    retry_count = 0
    # Rate limit when signed in is documented at 50 per hour
    backoff_time = 3600 // 60

    while retry_count < max_retries:
        response_text = ""
        try:
            cookie = get_cookie()
            headers = {"Cookie": cookie} if cookie else {}
            response = requests.get(url, headers=headers)
            response_text = response.text
            response.raise_for_status()

            log(f"Fetched {data_type} data for cell {cell.h3_cell_id} at lat {cell.lat} and lon {cell.lon}")
            save_cell_data(cell, response_text, data_type)
            sleep(backoff_time)  # Sleep for a short time to avoid overwhelming the API

            return
        except requests.RequestException as e:
            log(f"Error fetching data for cell {cell.h3_cell_id}: {e}. {response_text}. Retrying in {backoff_time} seconds...")
            sleep(backoff_time)
            backoff_time *= 2  # Exponentially increase the backoff time
            retry_count += 1

    log(f"Failed to fetch data for cell {cell.h3_cell_id} after {max_retries} retries.")


def sleep(seconds: int):
    log(f"Sleeping for {seconds} seconds...")
    time.sleep(seconds)


def save_cell_data(cell: H3CellData, data: str, data_type: DataType):
    if not data:
        return

    filename = filename_for_cell(cell, data_type)
    file_path = os.path.join(directory_for_data, filename)
    with open(file_path, "w") as f:
        f.write(data)


def filename_for_cell(cell: H3CellData, data_type: DataType) -> str:
    return f"{data_type}_h3_res_{H3_RESOLUTION}_cell_{cell.h3_cell_id}.csv"


if __name__ == "__main__":
    fetch_all_data()
    # existing_data_files = set(os.listdir(directory_for_data))
    # # log(existing_data_files)

    # for filename in existing_data_files:
    #     if filename.endswith(".csv.csv"):
    #         log(f"Processing {filename}...")
    #         new_filename = filename.replace(".csv.csv", ".csv")
    #         os.rename(os.path.join(directory_for_data, filename), os.path.join(directory_for_data, new_filename))
