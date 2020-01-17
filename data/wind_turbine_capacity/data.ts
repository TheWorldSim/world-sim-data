import { ATTRIBUTES } from "../../src/schema"
import { aggregate_all_capacity_factor_data } from "./aggregate_data"


const instances: ATTRIBUTES = {}

const wind_turbine_capacity_data: ATTRIBUTES = {
    wind_turbine_capacity: {
        attributes: {},
        instances,
    },
}


;[
    {
        "region": "texas__offshore",
        "year": 2018,
        "hub_height": 80,
        "turbine_model_name": "Vestas V90 2000"
    },
    {
        "region": "texas",
        "year": 2018,
        "hub_height": 80,
        "turbine_model_name": "Vestas V90 2000"
    },
    {
        "region": "united_kingdom__offshore",
        "year": 2018,
        "hub_height": 80,
        "turbine_model_name": "Vestas V90 2000"
    },
    {
        "region": "united_kingdom",
        "year": 2018,
        "hub_height": 80,
        "turbine_model_name": "Vestas V90 2000"
    },
].forEach(params => {
    const { region, year, hub_height, turbine_model_name } = params

    const version = "core@0.0.4-alpha.csv"

    instances[`${region}_${year}_${hub_height}_${turbine_model_name.replace(/ /g, "_")}`] = {
        value_refs: [
            {
                value_file: `wind_turbine_capacity/data/${year}_${region}_${hub_height}_${turbine_model_name.replace(/ /g, "-")}@${version}`,
                columns: [
                    "datetime",
                    {
                        "property": "latlon",
                        "values_file": `regions/${region}@core@0.0.3.csv`,
                    }
                ],
                meta_data: {
                    units: {
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
    aggregate_all_capacity_factor_data(instances)
}


export {
    wind_turbine_capacity_data
}
