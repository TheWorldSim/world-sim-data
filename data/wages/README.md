

1. Download the CSV data from http://data-explorer.oecd.org/s/2ay AKA https://data-explorer.oecd.org/vis?fs[0]=Topic%2C0%7CEmployment%23JOB%23&pg=40&fc=Topic&bp=true&snb=68&df[ds]=dsDisseminateFinalDMZ&df[id]=DSD_EARNINGS%40MIN2AVE&df[ag]=OECD.ELS.SAE&df[vs]=1.0&dq=......&pd=2000%2C&to[TIME_PERIOD]=false&vw=tb
2. Save the downloaded file as `data/wages/oecd_min_wages.csv`.
3. Run the script `data/wages/clean_wages.py` to clean and process the data.
    1. This will remove a lot of redundant columns
    2. Rename some columns for clarity
    3. Merge the mean and median rows into a single row per country/year
    4. Ensure the data is sorted by country and year
    5. Produce a map from short country codes to full country names
4. Upload the data to https://wikisim.org/wiki/1170
