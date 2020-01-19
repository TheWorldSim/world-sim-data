import { ATTRIBUTES } from "../../src/schema"
import { aggregate_all_capacity_factor_data } from "../../src/aggregate_data"


const wind_turbine_capacity_instances: ATTRIBUTES = {}

const wind_turbine_capacity_data: ATTRIBUTES = {
    wind_turbine_capacity: {
        attributes: {},
        instances: wind_turbine_capacity_instances,
    },
}


const wind_turbine_capacity_params = [
    "texas__offshore",
    "texas",
    "united_kingdom__offshore",
    "united_kingdom",
].map(region => ({
    region, year: "2018", hub_height: 80, turbine_model_name: "Vestas V90 2000"
}))


wind_turbine_capacity_params.forEach(params => {
    const { region, year, hub_height, turbine_model_name } = params

    const instance_id = `${year}_${region}_${hub_height}_${turbine_model_name.replace(/ /g, "_")}`
    const version = "core@0.0.4"
    const value_file = `wind_turbine_capacity/data/${instance_id}@${version}.csv`

    wind_turbine_capacity_instances[instance_id] = {
        value_refs: [
            {
                value_file,
                bundles: ["regional"],
                columns: [
                    "datetime",
                    {
                        "property": "latlon",
                        "values_file": `regions/${region}@core@0.0.3.csv`,
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
                comment: "A combined data set of renewables ninja wind data with region latlons",
                data_sets: [version]
            }
        ]
    }
})


if (require.main === module) {
    aggregate_all_capacity_factor_data(wind_turbine_capacity_instances)
}


export {
    wind_turbine_capacity_data
}
