import ipdb
import pandas as pd

def process_wind_df(wind_df: pd.DataFrame) -> None:
    print(f"Processing wind data of {len(wind_df)} rows")
