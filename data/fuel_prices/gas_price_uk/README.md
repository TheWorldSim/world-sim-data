

# Gas price (UK)

## ONS Data
1. Download latest version of spreadsheet [from here](https://www.ons.gov.uk/economy/economicoutputandproductivity/output/datasets/systemaveragepricesapofgas/2026)
2. Open up "1.Daily SAP Gas" tab.
3. Change the date format to `YYYY-MM-DD` (e.g. 2024-01-01)
4. Copy and paste date and first price column into `ons_gas_price.csv` file.

## Trading Economics Data
Follow the insructions in [trading_economics.js](trading_economics.js) to generate
the data for the `trading_economics.csv` file.

## Merge data

Run `python3 merge_gas_price.py` to merge the data from the two sources into `gas_price_uk.csv`.


## energy-stats.uk
Might have useful data but would need more processing:
https://files.energy-stats.uk/csv_output/
