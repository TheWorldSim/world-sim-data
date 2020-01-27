import { ATTRIBUTES } from "../../src/schema"
import { aggregate_all_solarpv_capacity_factor_data } from "../../src/aggregate_data"


const solarpv_capacity_instances: ATTRIBUTES = {}

const solarpv_capacity_data: ATTRIBUTES = {
    solarpv_capacity: {
        attributes: {},
        instances: solarpv_capacity_instances,
    }
}


export interface SolarPVParams
{
    region: string
    year: number
    [key: string]: string | number | boolean
}


const solarpv_capacity_params: SolarPVParams[] = [
    "texas",
    "united_kingdom",
].map(region => {
    const years = [2017, 2018]
    return years.map(year => ({ region, year}))
}).reduce((accum, params) => accum.concat(params), [])


const version = "core@0.0.5"
solarpv_capacity_params.forEach(params => {
    const { region } = params

    const instance_id = get_instance_id(params)
    const value_file = get_data_file_path(instance_id)

    solarpv_capacity_instances[instance_id] = {
        value_refs: [
            {
                value_file,
                bundles: ["regional"],
                columns: [
                    "datetime",
                    {
                        "property": "latlon",
                        "values_file": `regions/data/${region}@core@0.0.3.csv`,
                    }
                ],
                meta_data: {
                    units: {
                        "datetime": "seconds since 1970",
                        "latlon": "degree,degree",
                    },
                    params
                },
                created: "2020-01-16 11:00:00 UTC",
                reference: "https://www.renewables.ninja",
                sub_ref: "",
                comment: "A combined data set of renewables ninja solar pv data with region latlons.  These data are at a single latlon point, so we need to assess how useful they are.  For example, if there's a hill near the point, the capacity factor might be much higher or lower than the area this is intended to represent.",
                data_sets: [version]
            }
        ]
    }
})



function get_instance_id (params: SolarPVParams)
{
    const { year, region } = params
    return `_${year}_${region}_loss10percent_tracking1_tilt35_azim180`
}

function get_data_file_path (instance_id: string)
{
    return `solarpv_capacity/data/${instance_id}@${version}.csv`
}


if (require.main === module) {
    aggregate_all_solarpv_capacity_factor_data(solarpv_capacity_instances)
}


export {
    solarpv_capacity_params,
    solarpv_capacity_data,
    get_instance_id,
    get_data_file_path,
}
