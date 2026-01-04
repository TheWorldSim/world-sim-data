import csv


input_file = "./oecd_min_wages.csv"
output_file = "./cleaned_min_wages.csv"
output_country_map_file = "./country_name_map.csv"


def clean_wages():
    data_dicts = dict()
    country_name_map = dict()

    with open(input_file, mode="r", encoding="utf-8-sig") as infile:
        reader = csv.DictReader(infile)

        for row in reader:
            country_code = row["REF_AREA"]
            country_name = row["Reference area"]
            country_name_map[country_code] = country_name

            data_dicts[country_code] = data_dicts.get(country_code, dict())

            year = row["TIME_PERIOD"]
            data_dicts[country_code][year] = data_dicts[country_code].get(year, dict())

            operation = row["AGGREGATION_OPERATION"]

            value = row["OBS_VALUE"]
            # Limit value to 2 decimal places
            if value:
                value = f"{float(value):.2f}"

            data_dicts[country_code][year][operation] = value


    data_list = []
    for country_code, years in data_dicts.items():
        for year, operations in years.items():
            mean_wage = operations.get("MEAN", "")
            median_wage = operations.get("MEDIAN", "")
            data_list.append({
                "country": country_code,
                "year": year,
                "vs mean": mean_wage,
                "vs median": median_wage
            })


    # Sort data_list by country and year
    data_list.sort(key=lambda x: (x["country"], x["year"]))


    fieldnames = ["country_code", "year", "vs mean", "vs median"]

    with open(output_file, mode="w", newline="", encoding="utf-8") as outfile:
        writer = csv.DictWriter(outfile, fieldnames=fieldnames)
        writer.writeheader()

        for row in data_list:
            writer.writerow({
                "country_code": row["country"],
                "year": row["year"],
                "vs mean": row["vs mean"],
                "vs median": row["vs median"],
            })


    # Sort country_name_map by country_code
    country_name_map = dict(sorted(country_name_map.items(), key=lambda item: item[0]))

    with open(output_country_map_file, mode="w", newline="", encoding="utf-8") as country_map_file:
        writer = csv.DictWriter(country_map_file, fieldnames=["country_code", "country_name"])
        writer.writeheader()

        for country_code, country_name in country_name_map.items():
            writer.writerow({
                "country_code": country_code,
                "country_name": country_name
            })


if __name__ == "__main__":
    clean_wages()
