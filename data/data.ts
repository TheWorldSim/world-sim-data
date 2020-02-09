import fs = require("fs")

import { SCHEMA } from "../src/schema"
import { safe_merge } from "../src/safe_merge"
import { process_data_container } from "../src/process_data_container"

import { electricity_demand_data } from "./electricity_demand/data"
import { regions_data } from "./regions/data"
import { solarpv_capacity_data } from "./solarpv_capacity/data"
import { solarpv_capacity_summary_data } from "./solarpv_capacity_summary/data"
import { wind_farms_data } from "./wind_farms/data"
import { wind_turbine_capacity_data } from "./wind_turbine_capacity/data"
import { wind_turbine_capacity_summary_data } from "./wind_turbine_capacity_summary/data"


const data_container: SCHEMA = {
    schema_version: "0.7",
    data: safe_merge(
        electricity_demand_data,
        regions_data,
        solarpv_capacity_data,
        solarpv_capacity_summary_data,
        wind_farms_data,
        wind_turbine_capacity_data,
        wind_turbine_capacity_summary_data,
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
    data_set_configs:
    [
        {
            name: "core",
            draft_version: "0.0.11-alpha",
            release_version: "0.0.10",
            versions:
            [
                "0.0.10",
                "0.0.9",
                "0.0.8",
                "0.0.7",
                "0.0.6",
                "0.0.5",
                "0.0.4",
                "0.0.3",
                "0.0.2",
                "0.0.1",
            ]
        }
    ]
}


function write_data (params: { processed_data_container: SCHEMA, append_filename?: string, indent?: number, data_keys_seperate_lines?: boolean })
{
    const {
        processed_data_container,
        append_filename = "",
        indent = 0,
        data_keys_seperate_lines = false,
    } = params

    if (processed_data_container.schema_version !== "0.7") throw new Error("Unsupported schema version")

    let contents = ""

    if (data_keys_seperate_lines)
    {
        const data = processed_data_container.data
        processed_data_container.data = "<<REPLACE>>" as any

        contents = JSON.stringify(processed_data_container, null, indent)

        const data_rows: string[] = []
        Object.keys(data).sort().forEach(data_key => {
            const sub_data = data[data_key]
            data_rows.push(`"${data_key}":` + JSON.stringify(sub_data, null, indent))
        })
        const data_rows_string = "{\n  " + data_rows.join(",\n  ") + "\n}"
        contents = contents.replace(`"<<REPLACE>>"`, data_rows_string)

        processed_data_container.data = data
    }
    else
    {
        contents = JSON.stringify(processed_data_container, null, indent)
    }

    fs.writeFileSync(`./data/data${append_filename}.json`, contents)
}


const processed_data_container = process_data_container(data_container)

write_data({ processed_data_container, indent: 2 })
write_data({ processed_data_container, append_filename: "-compact", data_keys_seperate_lines: true })
