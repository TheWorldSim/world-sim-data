import fs = require("fs")

import {
    SCHEMA,
    ATTRIBUTES,
    PARENT_ATTRIBUTE,
    ATTRIBUTE,
    VALUE_REF,
    SIMPLE_VALUE_REF,
    REFERENCE_VALUE_REF,
    VALUES,
    COLUMNS,
    DERIVED_VALUE_REF,
} from "../src/schema"
import { regions_data } from "./regions/data"
import { wind_farms_data } from "./wind_farms/data"
import { safe_merge } from "../src/safe-merge"


const data_container: SCHEMA = {
    schema_version: "0.4",
    data: safe_merge(
        regions_data,
        wind_farms_data,
    ),
    units: {
        area: {
            si: "m^2",
            conversion: {
                "hectare": 10000,
                "km^2": 0.000001
            }
        },
        power: {
            si: "W",
            conversion: {
                "MW": 0.000001
            }
        }
    },
    data_sets: {
        core: {
            draft_version: "0.0.3-alpha",
            release_version: "0.0.2",
            _auto_versions: {
                "0.0.3-alpha": false,
                "0.0.2": true,
                "0.0.1": true
            }
        }
    }
}


/**
 * @param data 
 */
function process_data <U extends ATTRIBUTES> (data: U): U
{
    //console.log("process_data data: " + JSON.stringify(data).slice(0, 50))
    const processed_data: U = {} as any

    Object.keys(data).forEach(key => 
    {
        const object = data[key]

        let processed_object: typeof object = {} as any

        //console.log(`process_data object for key ${key}: `)// + JSON.stringify(object).slice(0, 50))

        let processed = false

        const instances = (object as PARENT_ATTRIBUTE).instances
        const attributes = (object as PARENT_ATTRIBUTE).attributes

        if (instances)
        {
            const processed_instances = process_data(instances!)
            ;(processed_object as PARENT_ATTRIBUTE).instances = processed_instances
            processed = true
        }
        
        if (attributes)
        {
            const processed_attributes = process_data(attributes)
            ;(processed_object as PARENT_ATTRIBUTE).attributes = processed_attributes
            processed = true
        }
        else
        {
            const value_refs = (object as ATTRIBUTE).value_refs
                        
            if (value_refs)
            {
                const processed_value_refs = value_refs.map(process_value_ref)
                ;(processed_object as ATTRIBUTE).value_refs = processed_value_refs
                processed = true
            }
            else if (!processed)
            {
                throw new Error("object not processed and does not have `attributes` or `value_refs`: " + JSON.stringify(object))
            }
        }

        (processed_data as any)[key] = processed_object
    })

    return processed_data
}


function process_value_ref (value_ref: VALUE_REF): VALUE_REF
{
    let simple_value_ref: SIMPLE_VALUE_REF = {
        ...value_ref as SIMPLE_VALUE_REF
    }

    if ((value_ref as REFERENCE_VALUE_REF).value_file)
    {
        var value_file = (value_ref as REFERENCE_VALUE_REF).value_file
        simple_value_ref.values = values_from_file(value_file)
    }

    if ((value_ref as DERIVED_VALUE_REF).calculation)
    {
        // TODO: calculate values and columns based on calculation
        simple_value_ref.values = (value_ref as DERIVED_VALUE_REF)._manual_values;
        simple_value_ref.columns = (value_ref as DERIVED_VALUE_REF)._manual_columns;
    }

    validate_values(simple_value_ref)

    simple_value_ref = flatten_values(simple_value_ref)

    return simple_value_ref
}


function values_from_file (file_name: string): VALUES
{
    const contents = fs.readFileSync("./data/" + file_name).toString()
    return contents.split("\n")
        .map(line => line.trim())
        .map(line => line.split(",").map(parseFloat))
}


function validate_values (value_ref: SIMPLE_VALUE_REF)
{
    const column_number = expected_column_number(value_ref.columns);

    value_ref.values.forEach(line_values => {
        // Will want to do something more advanced later based on value_ref.columns
        if (line_values.length !== column_number)
        {
            console.log("line_values", line_values)
            throw new Error(`Expected ${column_number} columns but got: ${line_values.length}`);
        }
    })
}


function expected_column_number (columns: COLUMNS): number
{
    return columns.length
}


function flatten_values (value_ref: SIMPLE_VALUE_REF): SIMPLE_VALUE_REF
{
    const processed_values = value_ref.values.reduce((accum, line_values) => accum.concat(line_values), [])

    const processed_value_ref: SIMPLE_VALUE_REF = {
        ...value_ref,
        values: processed_values as any
    }

    return processed_value_ref
}


function write_data ({ processed_data_container, append_filename = "", indent = 0 }: { processed_data_container: SCHEMA, append_filename?: string, indent?: number })
{
    if (processed_data_container.schema_version != "0.4") throw new Error("Unsupported schema version")

    fs.writeFileSync(`./data/data${append_filename}.json`, JSON.stringify(processed_data_container, null, indent))
}


const processed_data_container = {
    ...data_container,
    data: process_data(data_container.data)
}

write_data({ processed_data_container, indent: 2 })
write_data({ processed_data_container, append_filename: "-compact" })
