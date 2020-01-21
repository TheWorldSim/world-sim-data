import fs = require("fs")
import {
    ATTRIBUTES,
    ATTRIBUTE,
    COLUMNS_REFERENCE,
    FILE_VALUE_REF,
} from "./schema"
import { value_strings_from_file } from "./process_data"


const BASE_PATH = "../world-sim-data-tools/scraping/renewables-ninja-data/"
const read_wind_capacity_by_datetime_from_filename = factory_read_capacity_by_datetime_from_filename(
    BASE_PATH, "time,electricity,wind_speed")
const read_solarpv_capacity_by_datetime_from_filename = factory_read_capacity_by_datetime_from_filename(
    BASE_PATH, "time,electricity,irradiance_direct,irradiance_diffuse,temperature")

interface CapacityByDatetime
{
    license: string
    processed_lines: string[][]
}

function factory_read_capacity_by_datetime_from_filename (base_path: string, expected_header: string)
{
    return function (filename: string): CapacityByDatetime
    {
        const filepath = base_path + filename
        const contents_buffer = fs.readFileSync(filepath)
        const contents_string = contents_buffer.toString()
    
        const { header, license, processed_lines } = parse_capacity_by_datetime_from_file_contents(contents_string, filepath)
    
        if (header !== expected_header)
        {
            throw new Error(`Expecting header: ${expected_header} but got ${header}`)
        }
    
        return { license, processed_lines }
    }
}


const wind_capacity_by_datetime_for_latlon = factory_get_capacity_by_datetime_for_latlon(wind_capacity_data_file_name, read_wind_capacity_by_datetime_from_filename)
const solarpv_capacity_by_datetime_for_latlon = factory_get_capacity_by_datetime_for_latlon(solarpv_capacity_data_file_name, read_solarpv_capacity_by_datetime_from_filename)


// copied and translated from ../world-sim-data-tools/scraping/renewables_ninja.py
function wind_capacity_data_file_name (latlon: string[], value_ref: FILE_VALUE_REF)
{
    const region = value_ref.meta_data.params["region"]
    const year = value_ref.meta_data.params["year"]
    const hub_height = value_ref.meta_data.params["hub_height"]
    const turbine_model_name = (value_ref.meta_data.params["turbine_model_name"] as string).replace(/ /g, "-")
    return `${year}_${region}_wind_${hub_height}_${turbine_model_name}_${latlon[0]}_${latlon[1]}.csv`
}

// copied and translated from ../world-sim-data-tools/scraping/renewables_ninja.py
function solarpv_capacity_data_file_name (latlon: string[], value_ref: FILE_VALUE_REF)
{
    const region = value_ref.meta_data.params["region"]
    const year = value_ref.meta_data.params["year"]
    return `${year}_${region}_solarpv_loss0.1_tracking1_tilt35_azim180_${latlon[0]}_${latlon[1]}.csv`
}


interface CapacityByLatlonDatetimeGetter
{
    (latlon: string[], value_ref: FILE_VALUE_REF): CapacityByDatetime
}

function factory_get_capacity_by_datetime_for_latlon (
    capacity_data_file_name: (latlon: string[], value_ref: FILE_VALUE_REF) => string,
    read_capacity_by_datetime_from_filename: (filename: string) => CapacityByDatetime
): CapacityByLatlonDatetimeGetter
{
    return function (latlon: string[], value_ref: FILE_VALUE_REF)
    {
        const filename = capacity_data_file_name(latlon, value_ref)
        return read_capacity_by_datetime_from_filename(filename)
    }
}


function parse_capacity_by_datetime_from_file_contents(file_contents: string, filepath?: string)
{
    const lines = file_contents
        .split("\n")
        .map(line => line.trim())

    const license = extract_license(lines[0], filepath)

    const no_metadata_lines = lines
        .filter(line => !line.startsWith("#"))

    const header = no_metadata_lines[0]

    // slice header and trailing empty line
    const only_data_lines = no_metadata_lines.slice(1, -1)

    const processed_lines = only_data_lines.map(parse_line)
    
    return { header, license, processed_lines }
}


function extract_license (line: string, filepath?: string)
{
    const license_regex = /# Renewables\.ninja [^(]+\(Point API\) - (-?[\d.]+, -?[\d.]+ -) .+/g
    const match = license_regex.exec(line)
    
    if (!match)
    {
        const filepath_debug = filepath ? `(in filepath "${filepath}")` : `(no filepath given)`
        throw new Error(`Unsupported license header line ${filepath_debug}: ${line}`)
    }

    const latlon = match[1]
    const license = line.replace(latlon, "")

    return license
}


function parse_line (line: string)
{
    const values = line.split(",")
    // We only care about the electricity value which also because it is
    // in kW and the generator capacity is set to 1 kW it means we can use
    // it directly as the capacity factor
    // We also times by 1000 as this removes the 0. and drops the file size
    // from 3.7 Mb to 2.4 Mb for texas__offshore wind
    return [values[0], (parseFloat(values[1]) * 1000).toString()]
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


function aggregate_capacity_factor_data (capacity_by_datetime_for_latlon: CapacityByLatlonDatetimeGetter, latlons: string[][], value_ref: FILE_VALUE_REF)
{
    const all_data: string[][] = []

    // Add first two columns and record expected_datetimes
    const expected_datetimes: string[] = []
    const { license: first_license, processed_lines: first_capacity } = capacity_by_datetime_for_latlon(latlons[0], value_ref)
    first_capacity.forEach(row => {
        const [datetime, capacity_factor] = row
        expected_datetimes.push(datetime)
        const datetime_in_seconds = (new Date(datetime).getTime() / 1000).toString()
        all_data.push([datetime_in_seconds, capacity_factor])
    })

    // Add remaining columns
    latlons.slice(1).forEach(latlon => {
        const { license: other_license, processed_lines: other_capacity } = capacity_by_datetime_for_latlon(latlon, value_ref)

        if (other_license !== first_license) throw new Error(`Different license at latlon: ${latlon} : "${other_license}" from expected "${first_license}"`)

        other_capacity.forEach((row, index) => {
            // check the first datetime stamps are the same
            const expected_datetime = expected_datetimes[index]
            const [actual_datetime, capacity] = row
            if (actual_datetime != expected_datetime)
            {
                throw new Error(`Incompatible wind capacity data datetime, have: ${actual_datetime} expecting: ${expected_datetime}`)
            }
            all_data[index].push(capacity)
        })
    })

    // Add license and header
    const latlon_headers = latlons.map(latlon => `"${latlon.join(",")}"`)
    all_data.unshift([first_license], [`"datetime"`, ...latlon_headers])
  
    return all_data
}


function write_data_to_file (data: (string | number)[][], value_ref: FILE_VALUE_REF)
{
    const contents = data.map(row => row.join(",")).join("\n")
    fs.writeFileSync("data/" + value_ref.value_file, contents)
}


function aggregate_all_capacity_factor_data (capacity_by_datetime_for_latlon: CapacityByLatlonDatetimeGetter, year_region_capacity_instances: ATTRIBUTES) {

    Object.keys(year_region_capacity_instances).forEach(year_region_capacity_instance_name => {
        const year_region_capacity_instance = year_region_capacity_instances[year_region_capacity_instance_name]

        const value_ref = (year_region_capacity_instance as ATTRIBUTE).value_refs[0] as FILE_VALUE_REF
        const latlons = load_latlons(value_ref)
        const data = aggregate_capacity_factor_data(capacity_by_datetime_for_latlon, latlons, value_ref)
        write_data_to_file(data, value_ref)
    })
}


export function aggregate_all_wind_capacity_factor_data (wind_turbine_capacity_instances: ATTRIBUTES) {
    aggregate_all_capacity_factor_data(wind_capacity_by_datetime_for_latlon, wind_turbine_capacity_instances)
}

export function aggregate_all_solarpv_capacity_factor_data (solarpv_capacity_instances: ATTRIBUTES) {
    aggregate_all_capacity_factor_data(solarpv_capacity_by_datetime_for_latlon, solarpv_capacity_instances)
}
