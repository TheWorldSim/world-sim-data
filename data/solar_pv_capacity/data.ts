import { ATTRIBUTES } from "../../src/schema"
import { aggregate_all_capacity_factor_data } from "../../src/aggregate_data"


const solar_pv_capacity_instances: ATTRIBUTES = {}

const solar_pv_capacity_data: ATTRIBUTES = {
    solar_pv_capacity: {
        attributes: {},
        instances: solar_pv_capacity_instances,
    }
}


// const solar_pv_capacity_params = [
//     "texas",
//     "united_kingdom",
// ].map(region => {
//     return [ { region, year: "2017" }, { region, year: "2018" }]
// }).reduce((accum, params) => accum.concat(params), [])


// solar_pv_capacity_params.forEach(params => {
//     const { region, year } = params

//     const instance_id = `${year}_${region}_${hub_height}_${turbine_model_name.replace(/ /g, "_")}`
//     const version = "core@0.0.4.csv"
//     const value_file = `solar_pv_capacity/data/${instance_id}@${version}`

//     solar_pv_capacity_instances[instance_id] = {
//         value_refs: [
//             {
//                 value_file,
//                 columns: [
//                     "datetime",
//                     {
//                         "property": "latlon",
//                         "values_file": `regions/${region}@core@0.0.3.csv`,
//                     }
//                 ],
//                 meta_data: {
//                     units: {
//                         "latlon": "degree,degree",
//                         // "hub_height": "m",
//                     },
//                     params
//                 },
//                 created: "2020-01-16 11:00:00 UTC",
//                 reference: "https://www.renewables.ninja",
//                 sub_ref: "",
//                 comment: "A combined data set of renewables ninja solar pv data with region latlons",
//                 data_sets: [version]
//             }
//         ]
//     }
// })


if (require.main === module) {
    aggregate_all_capacity_factor_data(solar_pv_capacity_instances)
}


export {
    solar_pv_capacity_data
}
