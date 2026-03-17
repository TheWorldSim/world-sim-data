from datetime import datetime

# Note that you need to perform a few manual changes to the text copied from:
# https://www.consumercouncil.org.uk/home-heating/price-checker/archive
#
# 1. find and replace all tabs with commas
# 2. remove £ signs
# 3. add "date" as the first column header
#
# Then you can run this script to convert the date strings into ISO format


input_filename = "heating_oil_uk.txt"
output_filename = "heating_oil_uk.csv"

processed_csv = ""

with open(input_filename, "r") as f:
    lines = f.readlines()

for line in lines:
    line = line.strip()
    if line.startswith("date"):
        processed_csv += line + "\n"
        continue
    if line == "":
        continue
    parts = line.split(",")
    date = parts[0]

    # convert date from "1 Jan 2020" to "2020-01-01"
    date_parts = date.split(" ")
    day = date_parts[0]
    month = date_parts[1]
    year = date_parts[2]
    new_date = datetime.strptime(f"{day} {month} {year}", "%d %B %Y")
    new_date_str = new_date.strftime("%Y-%m-%d")

    prices = parts[1:]
    processed_csv += f"{new_date_str},{','.join(prices)}\n"


with open(output_filename, "w") as f:
    f.write(processed_csv)
