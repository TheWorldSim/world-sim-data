import { ATTRIBUTES } from "../../src/schema"


const electricity_demand_instances: ATTRIBUTES = {}

const electricity_demand_data: ATTRIBUTES = {
    electricity_demand: {
        attributes: {},
        instances: electricity_demand_instances,
    },
}


const demand_regions_params = [
    "texas",
//    "united_kingdom",
].map(region => ({
    region, year: "2018"
}))


demand_regions_params.forEach(params => {
    const { region, year } = params

    const instance_id = `${year}_${region}_mw_electricity_demand`
    const version = "core@0.0.10"
    const value_file = `electricity_demand/data/${instance_id}@${version}.csv`

    electricity_demand_instances[instance_id] = {
        value_refs: [
            {
                value_file,
                bundles: ["regional"],
                columns: [
                    "datetime",
                    "ercot_electricity_demand",
                ],
                meta_data: {
                    units: {
                        "datetime": "seconds since 1970",
                        "ercot_electricity_demand": "MW",
                    },
                    params
                },
                created: "2019-12-30 12:06:00 UTC",
                reference: "http://www.ercot.com/gridinfo/load/load_hist",
                sub_ref: "",
                comment: "This is only ERCOT, not the whole of or only Texas.  Downloaded excel file and saved as CSV with underscore seperated variables",
                data_sets: [version]
            }
        ]
    }
})


export {
    electricity_demand_data
}
