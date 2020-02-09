import fs = require("fs")

const files_to_process = [
    "2018_texas_mw_electricity_demand@core@0.0.10"
]

const BASE_PATH = "./data/electricity_demand/data/"

function process_files (file_names: string[])
{
    file_names.forEach(file_name => {
        const contents = fs.readFileSync(BASE_PATH + file_name + ".original.csv").toString()

        const lines = contents.split("\n").map(l => l.trim())

        const lines_no_header_or_trailing = lines.slice(1, -1)

        const converted_lines: string[] = []

        lines_no_header_or_trailing.forEach(line => {
            const parts = line.split(`_`)
                // the numbers are exported with commas seperating every 10^3
                .map(part => part.replace(",", ""))

            // convert the datetime to seconds since 1970
            const date_str = parts[0] + "Z+0"
            const seconds_since_1970 = new Date(date_str).getTime() / 1000
            const seconds_since_1970_at_time_period_start = seconds_since_1970 - 3600
            const MW = parseInt(parts[parts.length - 1], 10) // drops the two DP precision
            const converted_line = `${seconds_since_1970_at_time_period_start},${MW}`
            converted_lines.push(converted_line)
        })

        converted_lines.unshift(`"datetime","ercot_electricity_demand"`)

        const new_contents = converted_lines.join("\n")

        fs.writeFileSync(BASE_PATH + file_name + ".csv", new_contents)
    })
}


if (require.main === module) {
    process_files(files_to_process)
}
