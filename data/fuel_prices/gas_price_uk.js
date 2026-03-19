// 1. Go to https://tradingeconomics.com/commodity/uk-natural-gas
// 2. Change the time range to 10 years
// 3. Open the console and paste in this code
// 4. Move the mouse over the graph to show all the different data points and have
//    them collected into the scraped_data object
// 5. call the print_result function by typing:  print_result()
//    into the console and pressing the enter key
// 6. If any dates are missing then go back and move the mouse over these dates
//    then do step 5 again.
//


let scraped_data = {}

print_result = (function ()
{
    let hnd = null
    function start_collecting ()
    {
        hnd = setInterval(() =>
        {
            const date_str = document.body.getElementsByClassName("yLabelDrag")[0].innerText
            const value_str = document.body.getElementsByClassName("closeLabel")[0].innerText
            scraped_data[date_str] = value_str
        }, 10)
    }


    function print_result ()
    {
        // clearInterval(hnd)

        // Order the data by date
        const ordered_data = Object.entries(scraped_data).sort((a, b) => new Date(a[0]) - new Date(b[0]))

        // Check for missing dates
        let last_date = null
        const _8_days = 8 * 24 * 60 * 60 * 1000
        ordered_data.forEach(([date, value]) =>
        {
            const current_date = new Date(date)
            if (last_date)
            {
                const diff = current_date.getTime() - last_date.getTime()
                if (diff > _8_days)
                {
                    console.error(`Missing date(s) between: ${last_date.toString()} and ${date}`)
                }
            }
            last_date = current_date
        })
        console.error("Checked for missing dates")

        function parse_date_as_UTC(date_str)
        {
            // Parse the string (e.g., "Apr 04 2016")
            const [month_str, day_str, year_str] = date_str.split(" ")
            const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
            const month = months.indexOf(month_str)
            const day = parseInt(day_str, 10)
            const year = parseInt(year_str, 10)
            // Create a Date object in UTC
            const utc_date = new Date(Date.UTC(year, month, day))
            return utc_date.toISOString().split('T')[0]
        }

        // Print as CSV
        let csv = "date,GBp per thm\n"
        ordered_data.forEach(([date, value]) =>
        {
            const iso_date = parse_date_as_UTC(date)
            csv += `${iso_date},${value}\n`
        })

        // We use console.error as the site has blocked the console.log
        console.error(csv)
    }


    start_collecting()

    return print_result
}())
