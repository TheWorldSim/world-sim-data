

field_id = "Ref ID"
field_technology_type = "Technology Type"
field_installed_capacity = "Installed Capacity (MWelec)"
field_solar_site_area = "Solar Site Area (sqm)"
field_turbine_capacity = "Turbine Capacity (MW)"
field_number_of_turbines = "No. of Turbines"
field_height_of_turbines = "Height of Turbines (m)"
field_development_status = "Development Status (short)"
field_operational_date = "Operational"
field_x_coord = "X-coordinate"
field_y_coord = "Y-coordinate"


new_field_power_density_initial = "Power density (W/sqm) initial"
new_field_use_orig_power_density = "Use original Power density"
new_field_power_density_3 = "Power density (W/sqm) corrected"
new_field_predicted_area = "predicted area (sqm)"
new_field_area = "area (sqm)"
new_field_lon_coord = "lon"
new_field_lat_coord = "lat"

technology_types = {
    "ACT": "Advanced Conversion Technologies",
    "AD": "Anaerobic Digestion",
    "battery": "Battery",
    "biomass_co": "Biomass (co-firing)",
    "biomass_only": "Biomass (dedicated)",
    "CAES": "Compressed Air Energy Storage",
    "incinerator": "EfW Incineration",
    "flywheel": "Flywheels",
    "fuel_cell": "Fuel Cell (Hydrogen)",
    "geo": "Geothermal",
    "HDR": "Hot Dry Rocks (HDR)",
    "H2": "Hydrogen",
    "landfill_gas": "Landfill Gas",
    "hydro_large": "Large Hydro",
    "LAES": "Liquid Air Energy Storage",
    "pumped_hydro": "Pumped Storage Hydroelectricity",
    "sewage": "Sewage Sludge Digestion",
    "wave": "Shoreline Wave",
    "hydro_small": "Small Hydro",
    "PV": "Solar Photovoltaics",
    "tidal_lagoon": "Tidal Lagoon",
    "tidal_stream": "Tidal Stream",
    "unknown": "Unknown",
    "wind_offshore": "Wind Offshore",
    "wind_onshore": "Wind Onshore",
}

development_status_types = {
    "Abandoned": "Abandoned",
    "Appeal Lodged": "Appeal Lodged",
    "Appeal Withdrawn": "Appeal Withdrawn",
    "Appeal Refused": "Appeal Refused",
    "Application Submitted": "Application Submitted",
    "Application Withdrawn": "Application Withdrawn",
    "Application Refused": "Application Refused",
    "No Application Required": "No Application Required",
    "Revised": "Revised",
    "Planning Permission Expired": "Planning Permission Expired",
    # Note that "Awaiting Construction" includes projects with
    # development status (not the short version) of:
    #      Appeal Granted
    #      Planning Permission Granted
    #      Planning Permission Refused
    #      Planning permission Granted
    #      Planning permission granted
    #      Secretary of State - Granted
    "Awaiting Construction": "Awaiting Construction",
    "Under Construction": "Under Construction",
    "Operational": "Operational",
}
development_status_potential = set([
    # development_status_types["Abandoned"],
    development_status_types["Appeal Lodged"],
    # development_status_types["Appeal Withdrawn"],
    # development_status_types["Appeal Refused"],
    development_status_types["Application Submitted"],
    # development_status_types["Application Withdrawn"],
    # Might these still be approved on appeal?
    # development_status_types["Application Refused"],
    development_status_types["No Application Required"],
    development_status_types["Revised"],
    # development_status_types["Planning Permission Expired"],
    # See note above about these containing some projects
    development_status_types["Awaiting Construction"],
    development_status_types["Under Construction"],
    development_status_types["Operational"],
])
development_status_to_include = set([
    development_status_types["Operational"],
    *development_status_potential,
])
