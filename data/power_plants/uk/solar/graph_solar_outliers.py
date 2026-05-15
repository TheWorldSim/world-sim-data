import ipdb
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression

from constants import (
    field_installed_capacity,
    field_solar_site_area,
)

def graph_solar_outliers(solar_df: pd.DataFrame, solar_farm_power_to_area_model: LinearRegression):
    # filter out nans
    fdf = solar_df[[field_installed_capacity, field_solar_site_area]].dropna()

    x_data = fdf[[field_installed_capacity]].values
    fdf["predicted area"] = solar_farm_power_to_area_model.predict(x_data)

    # Colour points based on how much they deviate from the predicted power density
    fdf["deviation"] = abs(
        np.log(fdf[field_solar_site_area].values) - np.log(fdf["predicted area"])
    )
    log_base = 1.4
    fdf["deviation_compressed"] = np.log(fdf["deviation"] + 1) / np.log(log_base)

    y_data = pd.DataFrame((fdf[field_installed_capacity] * 1e6) / fdf[field_solar_site_area])

    fig, ax = plt.subplots()
    scatter = ax.scatter(x_data, y_data, c=fdf["deviation_compressed"], cmap="coolwarm", alpha=0.7, label="Data")
    plt.colorbar(scatter, label="Deviation from Predicted Area (log compressed)")

    plt.xlabel(field_installed_capacity)
    plt.ylabel("Solar Farm Installed Power Density (W/m^2)")
    plt.title("Solar Farm Installed Power Density vs Installed Capacity")
    plt.grid(True)
    plt.xscale("log")
    plt.yscale("log")
    plt.show()
