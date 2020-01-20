import { ATTRIBUTES } from "../../src/schema"
import { aggregate_all_solarpv_capacity_factor_data } from "../../src/aggregate_data"


const solarpv_capacity_instances: ATTRIBUTES = {}

const solarpv_capacity_data: ATTRIBUTES = {
    solarpv_capacity: {
        attributes: {},
        instances: solarpv_capacity_instances,
    }
}


const solarpv_capacity_params = [
    "texas",
    "united_kingdom",
].map(region => {
    return [ { region, year: "2017" }, { region, year: "2018" }]
}).reduce((accum, params) => accum.concat(params), [])


solarpv_capacity_params.forEach(params => {
    const { region, year } = params

    const instance_id = `${year}_${region}_loss10percent_tracking1_tilt35_azim180`
    const version = "core@0.0.5"
    const value_file = `solarpv_capacity/data/${instance_id}@${version}.csv`

    solarpv_capacity_instances[instance_id] = {
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
                        "latlon": "degree,degree",
                        // "hub_height": "m",
                    },
                    params
                },
                created: "2020-01-16 11:00:00 UTC",
                reference: "https://www.renewables.ninja",
                sub_ref: "",
                comment: "A combined data set of renewables ninja solar pv data with region latlons",
                data_sets: [version]
            }
        ]
    }
})


if (require.main === module) {
    aggregate_all_solarpv_capacity_factor_data(solarpv_capacity_instances)
}


export {
    solarpv_capacity_data
}
