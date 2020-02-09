import { ATTRIBUTES } from "../../src/schema"
import { CAPACITY_SUMMARY, get_capacity_summary_name, summarise_capacity_factor_data } from "../../src/summarise_data"
import { solarpv_capacity_params, get_instance_id, get_data_file_path } from "../solarpv_capacity/data"


const solarpv_capacity_summary_instances: ATTRIBUTES = {}

const solarpv_capacity_summary_data: ATTRIBUTES = {
    solarpv_capacity_summary: {
        attributes: {},
        instances: solarpv_capacity_summary_instances,
    },
}


const capacity_summaries: CAPACITY_SUMMARY[] = [
    { bucket_size: "year", subdivide_by_hour: false },
    { bucket_size: "month", subdivide_by_hour: false },
    { bucket_size: "year", subdivide_by_hour: true },
    { bucket_size: "month", subdivide_by_hour: true },
]


solarpv_capacity_params.forEach(params => {
    const { region } = params
    const instance_id = get_instance_id(params)

    const attributes: ATTRIBUTES = {}
    solarpv_capacity_summary_instances[instance_id] = { attributes }

    const version = "core@0.0.10"

    capacity_summaries.forEach(capacity_summary => {
        const capacity_summary_name = get_capacity_summary_name(capacity_summary)
        const value_file = `solarpv_capacity_summary/data/${instance_id}_${capacity_summary_name}@${version}.csv`

        attributes[capacity_summary_name] = {
            value_refs: [
                {
                    value_file,
                    bundles: ["regional"],
                    columns: [
                        "temporal-id",
                        {
                            "property": "latlon",
                            "values_file": `regions/data/${region}@core@0.0.3.csv`,
                        }
                    ],
                    meta_data: {
                        units: {
                            "latlon": "degree,degree",
                            "hub_height": "m",
                        },
                        params: {
                            ...params,
                            ...capacity_summary,
                        }
                    },
                    created: "2020-01-21 19:00:00 UTC",
                    reference: "https://www.renewables.ninja",
                    sub_ref: "",
                    comment: "Summary stats of combined data set of renewables ninja wind data with region latlons.  See note on capacity data about need to assess how useful they are.",
                    data_sets: [version]
                }
            ]
        }

    })
})


if (require.main === module) {
    summarise_capacity_factor_data(get_data_file_path, solarpv_capacity_summary_instances, capacity_summaries)
}


export {
    solarpv_capacity_summary_data
}
