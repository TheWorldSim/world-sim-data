import fs = require("fs")

import { SCHEMA } from "../src/schema"
import { safe_merge } from "../src/safe-merge"
import { process_data_container } from "../src/process-data-container"

import { regions_data } from "./regions/data"
import { solarpv_capacity_data } from "./solarpv_capacity/data"
import { wind_farms_data } from "./wind_farms/data"
import { wind_turbine_capacity_data } from "./wind_turbine_capacity/data"


const data_container: SCHEMA = {
    schema_version: "0.6",
    data: safe_merge(
        regions_data,
        solarpv_capacity_data,
        wind_farms_data,
        wind_turbine_capacity_data,
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
    data_sets:
    [
        {
            name: "core",
            draft_version: "0.0.5-alpha",
            release_version: "0.0.4",
            versions:
            [
                "0.0.4",
                "0.0.3",
                "0.0.2",
                "0.0.1",
            ]
        }
    ]
}


function write_data ({ processed_data_container, append_filename = "", indent = 0 }: { processed_data_container: SCHEMA, append_filename?: string, indent?: number })
{
    if (processed_data_container.schema_version != "0.6") throw new Error("Unsupported schema version")

    fs.writeFileSync(`./data/data${append_filename}.json`, JSON.stringify(processed_data_container, null, indent))
}


const processed_data_container = process_data_container(data_container)

write_data({ processed_data_container, indent: 2 })
write_data({ processed_data_container, append_filename: "-compact" })
