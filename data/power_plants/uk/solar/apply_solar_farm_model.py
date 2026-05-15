import ipdb
import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression

from constants import (
    field_installed_capacity,
    field_solar_site_area,

    new_field_predicted_area,
    new_field_area,
)

# This function uses the solar farm power density model to predict the solar
# farm area in sqm from the solar farm's installed capacity for solar farms that
# have an installed capacity:
# 1. but no area, or
# 2. have an area but it seems to be an outlier

# Note that this threshold for outliers can be set to None to prevent correcting
# (or perhaps incorrecting!) the data
def apply_solar_farm_model(solar_df: pd.DataFrame, solar_farm_power_to_area_model: LinearRegression, outlier_threshold: float = 0.5):
    def predict_area(row):
        capacity = row[field_installed_capacity]
        area = row[field_solar_site_area]

        if pd.isna(capacity) or capacity <= 0:
            return pd.NA
        predicted_area = solar_farm_power_to_area_model.predict(pd.DataFrame([capacity]))[0][0]

        use_predicted_area = pd.NA
        # ratio difference between predicted and actual area
        if not pd.isna(area):
            ratio_diff = abs(predicted_area - area) / area
            if ratio_diff > outlier_threshold:
                # Use predicted area if the actual area seems to be an outlier
                use_predicted_area = predicted_area
            # else:
            #     use_predicted_area = "reasonable"
        elif predicted_area > 0:
            # Use predicted area if actual area is missing
            use_predicted_area = predicted_area

        if isinstance(use_predicted_area, (float, np.floating)):
            use_predicted_area = int(use_predicted_area)

        return use_predicted_area

    solar_df[new_field_predicted_area] = solar_df.apply(predict_area, axis=1)
    # Set the new area to new_field_predicted_area or field_solar_site_area
    solar_df[new_field_area] = solar_df[new_field_predicted_area].combine_first(solar_df[field_solar_site_area]).map(float_to_int)


def float_to_int(value):
    if pd.isna(value):
        return pd.NaT
    try:
        return int(value)
    except (ValueError, TypeError):
        return pd.NaT
