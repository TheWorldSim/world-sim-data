import fs = require("fs");

import {
    SCHEMA,
    ATTRIBUTES,
    PARENT_ATTRIBUTE,
    ATTRIBUTE,
    VALUE_REF,
    SIMPLE_VALUE_REF,
    REFERENCE_VALUE_REF,
    VALUE,
} from "../src/schema"
import { regions_data } from "./regions/data"
import { wind_farms_data } from "./wind_farms/data"
import { safe_merge } from "../src/safe-merge"


const data: SCHEMA = {
    "schema_version": "0.2",
    "data": safe_merge(
        regions_data,
        wind_farms_data,
    ),
    "units": {
        "area": {
            "si": "m^2",
            "conversion": {
                "hectare": 10000,
                "km^2": 0.000001
            }
        },
        "power": {
            "si": "W",
            "conversion": {
                "MW": 0.000001
            }
        }
    },
    "data_sets": {
        "core": {
            "draft_version": "0.0.3-alpha",
            "release_version": "0.0.2",
            "_auto_versions": {
                "0.0.3-alpha": false,
                "0.0.2": true,
                "0.0.1": true
            }
        }
    }
}


/**
 * mutates the data
 * @param data 
 */
function process_data (data: ATTRIBUTES)
{
    //console.log("process_data data: " + JSON.stringify(data).slice(0, 50))
    Object.keys(data).forEach(key => 
    {
        const object = data[key]
        //console.log(`process_data object for key ${key}: ` + JSON.stringify(object).slice(0, 50))

        let processed = false

        const instances = (object as PARENT_ATTRIBUTE).instances
        const attributes = (object as PARENT_ATTRIBUTE).attributes

        if (instances)
        {
            process_data(instances!)
            processed = true
        }
        
        if (attributes)
        {
            process_data(attributes)
            processed = true
        }
        else
        {
            const value_refs = (object as ATTRIBUTE).value_refs
            if (value_refs)
            {
                value_refs.forEach(process_value_ref)
                processed = true
            }
            else if (!processed)
            {
                throw new Error("object not processed and does not have `attributes` or `value_refs`: " + JSON.stringify(object))
            }
        }
    })
}


function process_value_ref (value_ref: VALUE_REF)
{
    if ((value_ref as REFERENCE_VALUE_REF).value_file)
    {
        var value_file = (value_ref as REFERENCE_VALUE_REF).value_file
        delete (value_ref as REFERENCE_VALUE_REF).value_file
        const values: VALUE[] = values_from_file(value_file, value_ref)
        ;(value_ref as SIMPLE_VALUE_REF).values = values
    }
}


function values_from_file (file_name: string, value_ref: VALUE_REF): VALUE[]
{
    const contents = fs.readFileSync("./data/" + file_name).toString()
    return contents.split("\n")
        .map(line => line.trim())
        // Will want to do something more advanced later based on value_ref.columns, and value_ref.meta_data.units
        .map(line => line.split(",").map(parseFloat))
}


function write_data ({ append_filename = "", indent = 0 }: { append_filename?: string, indent?: number })
{
    if (data.schema_version != "0.2") throw new Error("Unsupported schema version")

    process_data(data.data)

    // TODO re-evaluate calculations

    fs.writeFileSync(`./data/data${append_filename}.json`, JSON.stringify(data, null, indent))
}


write_data({ indent: 2 })
write_data({ append_filename: "-compact" })
