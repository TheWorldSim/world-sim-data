# import csv reader and writer
import csv
from dataclasses import dataclass
from datetime import datetime
import os


current_dir = os.path.dirname(os.path.abspath(__file__))

file_names_to_process = [
    "daily_eur_to_gbp.csv",
    "daily_gbp_to_jpy.csv",
    "daily_gbp_to_usd.csv",
]


@dataclass
class ExchangeRateRecord:
    date: datetime
    rate: float

@dataclass
class MonthlyExchangeRateRecord:
    year: int
    month: int
    average_rate: float
    standard_deviation: float


def process_all_files():
    for file_name in file_names_to_process:
        monthly_averages = process_file(file_name)
        # Save to new CSV
        output_file_name = file_name.replace("daily", "monthly")
        with open(current_dir + "/derived/" + output_file_name, mode="w", newline="") as csvfile:
            writer = csv.writer(csvfile)
            writer.writerow(["Year", "Month", "Average Rate", "Standard Deviation"])
            for record in monthly_averages:
                writer.writerow([
                    record.year,
                    record.month,
                    f"{record.average_rate:.5f}",
                    f"{record.standard_deviation:.3f}"
                ])


def process_file(file_name: str) -> list[MonthlyExchangeRateRecord]:
    with open(current_dir + "/source/" + file_name, newline="") as csvfile:

        spamreader = csv.reader(csvfile, delimiter=" ", quotechar="|")
        current_month_rows = []
        current_month = None
        month_averages = []

        for index, row in enumerate(spamreader):
            if index == 0:
                continue  # skip header

            date_str, rate_str = row[0].split(",")
            # Parse the date 01/04/1999
            date = datetime.strptime(date_str.replace('"', ""), "%m/%d/%Y")
            if current_month is None:
                current_month = date
            elif date.month != current_month.month:
                month_average = process_monthly_data(current_month_rows, current_month)
                month_averages.append(month_average)
                current_month_rows = []
                current_month = date

            rate = float(rate_str)
            current_month_rows.append(ExchangeRateRecord(date=date, rate=rate))

        # type guard
        if current_month:
            # Process the last month
            month_average = process_monthly_data(current_month_rows, current_month)
            month_averages.append(month_average)

    return month_averages


def process_monthly_data(rows: list[ExchangeRateRecord], month: datetime) -> MonthlyExchangeRateRecord:
    rates = [record.rate for record in rows]
    average_rate = sum(rates) / len(rates)
    variance = sum((rate - average_rate) ** 2 for rate in rates) / len(rates)
    standard_deviation = variance ** 0.5

    return MonthlyExchangeRateRecord(
        year=month.year,
        month=month.month,
        average_rate=average_rate,
        standard_deviation=standard_deviation
    )


if __name__ == "__main__":
    process_all_files()
