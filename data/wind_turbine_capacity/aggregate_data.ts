import fs = require("fs")
import {
    ATTRIBUTES,
    ATTRIBUTE,
    COLUMNS_REFERENCE,
    FILE_VALUE_REF,
} from "../../src/schema"
import { value_strings_from_file } from "../../src/process-data"


const BASE_PATH = "../world-sim-data-tools/scraping/renewables-ninja-data/"
function read_wind_capacity_lines_from_file (filename: string)
{
    const filepath = BASE_PATH + filename
    const contents = fs.readFileSync(filepath)

    const lines = contents.toString()
        .split("\n")

    const no_metadata_lines = lines
        .map(line => line.trim())
        .filter(line => !line.startsWith("#"))
    
    const expected_headers = "time,electricity,wind_speed"
    if (no_metadata_lines[0] !== expected_headers)
    {
        throw new Error(`Expecting headers: ${expected_headers} but got ${no_metadata_lines[0]}`)
    }

    // slice header and trailing empty line
    const only_data_lines = no_metadata_lines.slice(1, -1)

    const processed_lines = only_data_lines.map(parse_line)

    return processed_lines
}


function parse_line (line: string)
{
    const values = line.split(",")
    // We only care about the electricity value which also because it is
    // in kW and the data set the capacity to 1 kW it means we can use
    // as the capacity factor
    // We also times by 1000 as this removes the 0. and drops the file size
    // from 3.7 Mb to 2.4 Mb
    return [values[0], (parseFloat(values[1]) * 1000).toString()]
}


function wind_capacity_data_file_name (latlon: string[], value_ref: FILE_VALUE_REF)
{
    const region = value_ref.meta_data.params["region"]
    const year = value_ref.meta_data.params["year"]
    const hub_height = value_ref.meta_data.params["hub_height"]
    const turbine_model_name = (value_ref.meta_data.params["turbine_model_name"] as string).replace(/ /g, "-")
    return `${year}_${region}_wind_${hub_height}_${turbine_model_name}_${latlon[0]}_${latlon[1]}.csv`
}


function latlon_values_file_name (value_ref: FILE_VALUE_REF)
{
    const latlons_column_definition = value_ref.columns![1] as COLUMNS_REFERENCE
    return latlons_column_definition.values_file
}


function load_latlons (value_ref: FILE_VALUE_REF): string[][]
{
    const values_file_name = latlon_values_file_name(value_ref)
    return value_strings_from_file(values_file_name, value_ref)
}


function aggregate_capacity_factor_data (latlons: string[][], value_ref: FILE_VALUE_REF)
{
    const all_data: string[][] = []

    // Add first two columns and record expected_datetimes
    const expected_datetimes: string[] = []
    const first_file_name = wind_capacity_data_file_name(latlons[0], value_ref)
    const first_wind_capacity = read_wind_capacity_lines_from_file(first_file_name)
    first_wind_capacity.forEach(row => {
        const [datetime, capacity_factor] = row
        expected_datetimes.push(datetime)
        const datetime_in_seconds = (new Date(datetime).getTime() / 1000).toString()
        all_data.push([datetime_in_seconds, capacity_factor])
    })

    // Add remaining columns
    latlons.slice(1).forEach(latlon => {
        const file_name = wind_capacity_data_file_name(latlon, value_ref)
        const wind_capacity = read_wind_capacity_lines_from_file(file_name)
        wind_capacity.forEach((row, index) => {
            // check the first datetime stamps are the same
            const expected_datetime = expected_datetimes[index]
            const actual_datetime = row[0]
            if (actual_datetime != expected_datetime)
            {
                throw new Error(`Incompatible wind capacity data datetime, have: ${actual_datetime} expecting: ${expected_datetime}`)
            }
            all_data[index].push(row[1])
        })
    })

    // Add header
    const latlon_headers = latlons.map(latlon => `"${latlon.join(",")}"`)
    all_data.unshift([`"datetime"`, ...latlon_headers])
  
    return all_data
}


function write_data_to_file (data: (string | number)[][], value_ref: FILE_VALUE_REF)
{
    const contents = data.map(row => row.join(",")).join("\n")
    fs.writeFileSync("data/" + value_ref.value_file, contents)
}


export function aggregate_all_capacity_factor_data (wind_turbine_capacities: ATTRIBUTES) {

    Object.keys(wind_turbine_capacities).forEach(data_group_name => {
        const wind_turbine_capacity = wind_turbine_capacities[data_group_name]

        const value_ref = (wind_turbine_capacity as ATTRIBUTE).value_refs[0] as FILE_VALUE_REF
        const latlons = load_latlons(value_ref)
        const data = aggregate_capacity_factor_data(latlons, value_ref)
        write_data_to_file(data, value_ref)
    })
}
