import os

import ipdb
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd


current_dir = os.path.dirname(os.path.abspath(__file__))
wind_farms_output_file_path = os.path.join(current_dir, "data/uk_subset_of_offshore_wind_farms.csv")
wind_farms_averages_output_file_path = os.path.join(current_dir, "data/uk_subset_of_offshore_wind_farm_average_power_densities.csv")


class fields:
    installed = "Installed Capacity (MW)"
    area_km2 = "Area (km²)"
    cf = "Capacity Factor (%)"
    period = "Data Period"
    pdi = "Installed Power Density (W/m²)"
    pdr = "Realised Power Density (W/m²)"


# Copied from table 1 of https://doi.org/10.1371/journal.pone.0321528
# which as of 2026-05-18 was hosted at: https://ndownloader.figstatic.com/files/54155111
data = [
    ["Windfarm", fields.installed, fields.area_km2, fields.cf, fields.period],
    ["HornseaTwo", 1386.0, 462.0, 41.4, "2023 - 2024"],
    ["HornseaOne", 1218.0, 407.3, 46.1, "2021 - 2023"],
    ["Seagreen", 1075.0, 332.0, 15.6, "2023 - 2024"],
    ["MorayEast", 950.0, 295.6, 25.3, "2022 - 2024"],
    ["TritonKnoll", 857.0, 149.0, 40.6, "2023 - 2024"],
    ["EastAngliaOne", 714.0, 162.8, 46.9, "2021, 2023"],
    ["WalneyExtension", 659.0, 149.1, 44.3, "2020 - 2023"],
    ["LondonArray", 630.0, 106.9, 41.9, "2020 - 2023"],
    ["Beatrice", 588.0, 131.3, 38.8, "2020 - 2023"],
    ["GwyntyMor", 576.0, 68.0, 35.2, "2020, 2022 - 2023"],
    ["RaceBank", 573.0, 62.4, 43.8, "2020 - 2023"],
    ["GreaterGabbard", 504.0, 146.1, 39.1, "2020 - 2023"],
    ["Dudgeon", 402.0, 55.1, 45.7, "2020 - 2023"],
    ["Rampion", 400.0, 56.3, 41.1, "2021 - 2023"],
    ["WestOfDuddonSands", 389.0, 67.0, 43.8, "2020 - 2023"],
    ["Galloper", 353.0, 113.7, 47.3, "2021 - 2023"],
    ["SheringhamShoals", 316.8, 35.0, 36.5, "2022 - 2023"],
    ["Lincs", 270.0, 38.9, 41.7, "2020 - 2023"],
    ["BurboBankExtension", 254.0, 39.6, 40.1, "2020 - 2023"],
    ["HumberGateway", 219.0, 27.0, 42.6, "2020 - 2023"],
    ["WestermostRough", 210.0, 34.9, 46.0, "2020 - 2023"],
    ["Walney1", 184.0, 27.1, 36.8, "2020 - 2023"],
    ["Walney2", 184.0, 45.9, 43.8, "2020 - 2023"],
    ["RobinRigg", 174.0, 18.3, 36.0, "2020 - 2023"],
    ["GunfleetSands", 173.0, 15.8, 35.4, "2020 - 2023"],
    ["Ormonde", 150.0, 9.9, 39.8, "2020"],
    ["Aberdeen", 96.8, 20.0, 36.8, "2020"],
    ["BurboBank", 90.0, 10.0, 31.8, "2020 - 2023"],
    ["Barrow", 90.0, 10.0, 31.7, "2021 - 2022"],
    ["Kincardine", 50.0, 20.0, 19.3, "2020 - 2023"],
    ["HywindScotland", 30.0, 15.4, 50.8, "2020 - 2023"],
]


def main():
    df = pd.DataFrame(data[1:], columns=data[0])

    df = calculate_power_density(df)

    # save to a csv
    df.to_csv(wind_farms_output_file_path, index=False)

    plot_installed_capacity_vs_area(df)
    plot_realised_power_density_vs_area(df)
    averages_df = calculate_average_power_density(df)
    averages_df.to_csv(wind_farms_averages_output_file_path, index=False)


def calculate_power_density(df: pd.DataFrame):
    df = df.copy()

    df[fields.pdi] = (df[fields.installed] / df[fields.area_km2]).round(1)

    df[fields.pdr] = (
        df[fields.pdi] * (df[fields.cf] / 100)
    ).round(1)

    return df


def plot_installed_capacity_vs_area(df: pd.DataFrame):
    x_data = df[fields.installed]
    y_data = df[fields.area_km2]

    # Create a linear line of best fit and a polynomial line of best fit, forced
    # to go through the origin (0, 0)
    # Weight the data points by the installed capacity, so that larger wind farms
    # have more influence on the line of best fit than smaller ones
    weights = df[fields.installed]
    # Add 0,0 to the data to force the line of best fit to go through the origin
    # and give it a very large weight to ensure the line of best fit goes through the origin
    x_fit_data = np.append(x_data, 0)
    y_fit_data = np.append(y_data, 0)
    weights = np.append(weights, weights.max() * 1000)

    linear_fit = np.polyfit(x_fit_data, y_fit_data, 1, w=weights)


    plt.figure(figsize=(10, 6))
    plt.scatter(x_data, y_data, alpha=0.7)
    plt.title("Area of UK Offshore Wind Farms vs Installed Capacity")
    plt.xlabel(fields.installed)
    plt.ylabel(fields.area_km2)
    plt.grid(True)

    # Plot the lines of best fit
    x_fit = np.linspace(min(x_data), max(x_data), 100)
    plt.plot(x_fit, np.polyval(linear_fit, x_fit), color="red", label="Linear Fit")
    plt.legend()

    # Add the equation of the line of best fit to the plot
    slope, intercept = linear_fit
    equation_text = f"y = {slope:.2f}x + {intercept:.2f}"
    plt.text(0.05, 0.95, equation_text, transform=plt.gca().transAxes, fontsize=10, verticalalignment="top")

    plt.savefig(os.path.join(current_dir, "installed_capacity_vs_area.png"))
    plt.show()


def plot_realised_power_density_vs_area(df: pd.DataFrame):
    x_data = df[fields.area_km2]
    y_data = df[fields.pdr]

    # Make line of best fit from equation 17 in the paper: https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0321528#pone.0321528.e052
    # Where ZP equals 0.74 Wm⁻², and WP equals 3729 Wm⁻¹
    Zp = 0.74
    Wp = 3729
    x_fit_area_km2 = np.linspace(min(x_data), max(x_data), 100)
    circumference_km = 2 * np.pi * np.sqrt(x_fit_area_km2 / np.pi)  # Assuming circular wind farms
    circumference_m = circumference_km * 1000  # Convert km to m
    x_fit_area_m2 = x_fit_area_km2 * 1e6  # Convert km² to m²
    y_fit = Wp * (circumference_m / x_fit_area_m2) + Zp

    plt.figure(figsize=(10, 6))
    plt.scatter(x_data, y_data, alpha=0.7)
    plt.title("Realised Power Density vs Area of UK Offshore Wind Farms")
    plt.xlabel("Area (km²)")
    plt.ylabel("Realised Power Density (W m⁻²)")
    plt.grid(True)

    # Plot the lines of best fit
    plt.plot(x_fit_area_km2, y_fit, color="red", label="Fitted using equation 17 & parameters from PLoS paper")
    plt.legend()
    plt.savefig(os.path.join(current_dir, "realised_power_density_vs_area.png"))
    plt.show()


def calculate_average_power_density(df: pd.DataFrame):
    df = df.copy()

    # Weight this by the fields.installed capacity, so that larger wind farms
    # have more influence on the average than smaller ones
    average_pdi = ((df[fields.pdi] * df[fields.installed]).sum() / df[fields.installed].sum()).round(1)
    average_pdr = ((df[fields.pdr] * df[fields.installed]).sum() / df[fields.installed].sum()).round(1)

    averages_df = pd.DataFrame({
        "country": "UK",
        "data description": "subset of offshore wind farms",
        fields.pdi: [average_pdi],
        fields.pdr: [average_pdr],
    })

    return averages_df


if __name__ == "__main__":
    main()
