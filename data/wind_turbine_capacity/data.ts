import { ATTRIBUTES } from "../../src/schema"
import { aggregate_all_wind_capacity_factor_data } from "../../src/aggregate_data"


const wind_turbine_capacity_instances: ATTRIBUTES = {}
const wind_turbine_capacity_data: ATTRIBUTES = {
    wind_turbine_capacity: {
        attributes: {},
        instances: wind_turbine_capacity_instances,
    },
}


export interface WindTurbineParams
{
    region: string
    year: number
    hub_height: number
    turbine_model_name: string
    [key: string]: string | number | boolean
}

const capacity_params_by_region_windturbine_and_year: WindTurbineParams[] = [
    "texas__offshore",
    "texas",
    "united_kingdom__offshore",
    "united_kingdom",
].map(region => ({
    region, year: 2018, hub_height: 80, turbine_model_name: "Vestas V90 2000"
}))


const version = "core@0.0.10"
capacity_params_by_region_windturbine_and_year.forEach(params => {
    const { region } = params

    const instance_id = get_instance_id(params)
    const value_file = get_data_file_path(instance_id)

    wind_turbine_capacity_instances[instance_id] = {
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
                        "hub_height": "m",
                    },
                    params
                },
                created: "2020-01-16 11:00:00 UTC",
                reference: "https://www.renewables.ninja",
                sub_ref: "",
                comment: "A combined data set of renewables ninja wind data with region latlons.  These data are at a single latlon point, so we need to assess how useful they are.  For example, if there's a hill near the point, the capacity factor might be much higher or lower than the area this is intended to represent.",
                data_sets: [version]
            }
        ]
    }
})


function get_instance_id (params: WindTurbineParams)
{
    const { year, region, hub_height, turbine_model_name } = params
    return `_${year}_${region}_${hub_height}_${turbine_model_name.replace(/ /g, "_")}`
}

function get_data_file_path (instance_id: string)
{
    return `wind_turbine_capacity/data/${instance_id}@${version}.csv`
}


if (require.main === module) {
    aggregate_all_wind_capacity_factor_data(wind_turbine_capacity_instances)
}


export {
    capacity_params_by_region_windturbine_and_year,
    wind_turbine_capacity_data,
    get_instance_id,
    get_data_file_path,
}
