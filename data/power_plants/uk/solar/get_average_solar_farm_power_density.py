import math

import ipdb
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression

from constants import (
    field_installed_capacity,
    field_solar_site_area,
    field_technology_type,
    new_field_power_density_initial,
    new_field_use_orig_power_density,
)


def set_new_field_power_density_initial(df):
    fdf = df[df.apply(is_valid_row, axis=1)]
    print(f"Number of rows with valid capacity and area: {len(fdf)} filtered down from {len(df)} total rows")

    df[new_field_power_density_initial] = (fdf[field_installed_capacity] * 1_000_000 / fdf[field_solar_site_area])


def get_solar_farm_power_to_area_model(df: pd.DataFrame):
    solar_df = df[df[field_technology_type] == "Solar Photovoltaics"]
    # Plot a log log scatter plot of capacity vs area for Solar PV rows with valid power density
    solar_df = solar_df[[field_installed_capacity, field_solar_site_area, new_field_power_density_initial]].dropna()

    # take first 100 rows
    solar_df = solar_df#.head(100)

    x = np.array(solar_df[field_installed_capacity].values).reshape(-1, 1)
    y = np.array(solar_df[field_solar_site_area].values)

    # 1. Initial linear best fit (red)
    model1 = fit_log_log(x, y)
    y_pred1 = model1.predict(x).flatten()

    ax = False  # change to True to show the graph
    if ax:
        fig, ax = plt.subplots()
        ax.scatter(x, y, alpha=0.7, label="Data")
        # Plot a straight line for the initial best fit (red)
        min_x, max_x = x.min(), x.max()
        x_fit = np.array([min_x, max_x]).reshape(-1, 1)
        y_fit = model1.predict(x_fit)
        ax.loglog(x_fit, y_fit, color="blue", label="Initial best fit using all data")

    # 2. Identify outliers (N% from fit line)
    n_percent = 50
    residuals = np.abs(y - y_pred1)
    residual_ratios = residuals / y_pred1
    outlier_indices = residual_ratios > (n_percent / 100)

    if ax:
        # Label outliers in red
        ax.scatter(x[outlier_indices], y[outlier_indices],
                color="red", edgecolor="black", label=f"Outliers ({n_percent}%)")

    # 3. Refit without outliers and plot new best fit (green)
    mask = np.ones(len(x), dtype=bool)
    mask[outlier_indices] = False
    x_inliers = x[mask]
    y_inliers = y[mask]

    model2 = fit_log_log(x_inliers, y_inliers)
    y_pred2 = model2.predict(x)

    if ax:
        ax.plot(x, y_pred2, color="green", label="Best fit (no outliers)")

        ax.set_xlabel(field_installed_capacity)
        ax.set_ylabel(field_solar_site_area)
        ax.set_title("Solar PV: Capacity vs Area (log-log)")
        ax.legend()
        plt.tight_layout()

        # Add the slope of the fit without outliers to the plot as an annotation in
        # the bottom right corner
        slope = model2.coef_[0][0]
        y_intercept = model2.intercept_[0] # type: ignore
        ax.annotate(f"Slope (no outliers): {slope:.2f}+{y_intercept:.2f}",
                    xy=(0.95, 0.05), xycoords="axes fraction",
                    ha="right", va="bottom", fontsize=10, color="green")

        plt.show()

    return model2


def is_valid_row(row):
    # return True to keep the row, False to drop it
    return (
        not math.isnan(row[field_installed_capacity]) and not pd.isna(row[field_solar_site_area])
        and row[field_installed_capacity] > 0 and row[field_solar_site_area] > 0
    )


def fit_log_log(x, y):
    log_log_model = LinearRegression()
    log_log_model.fit(np.log(x), np.log(y))

    # Extract the slope and intercept
    slope = log_log_model.coef_[0]
    intercept = log_log_model.intercept_

    # Convert back to the original power law form: y = A * x^B
    A = np.exp(intercept)
    B = slope

    # Make a new model that predicts y from x using the power law
    linear_model = LinearRegression()
    min_x, max_x = x.min(), x.max()
    x_fit = np.array([min_x, max_x]).reshape(-1, 1)
    linear_model.fit(x_fit, A * x_fit**B)
    return linear_model
