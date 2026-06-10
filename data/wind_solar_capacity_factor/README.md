

# Renewables Ninja

Added a script ./fetch_data.py to fetch the data from the Renewables Ninja API
for the UK EEZ aggregated by centeroid of H3 resolution 4 cells (with lat lons
rounded to 2 decimal places) as given by data
in [dgg/uk_eez_h3_res_4.txt](../dgg/uk_eez_h3_res_4.txt).

This will populate the ./input_data/uk_eez directory with files like:
wind_h3_res_4_cell_8419757ffffffff.csv and solar_h3_res_4_cell_8409a47ffffffff.csv from the renewables.ninja API.

## Rate limited renewables.ninja API

Please sign into Renewables.Ninja, make a request and copy the cookie sent in
the header to a .env.renewables_ninja_cookie.txt file.  Otherwise the requests
will be significantly rate limited; with the cookie the rate limit is increased
to 50 per hour.


# ./process_data.py

This proceses data from data/wind_solar_capacity_factor/input_data/uk_eez such as
wind_h3_res_4_cell_8419757ffffffff.csv and solar_h3_res_4_cell_8409a47ffffffff.csv from the renewables.ninja API.
