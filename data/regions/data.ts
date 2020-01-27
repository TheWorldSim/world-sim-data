import { ATTRIBUTES, VALUE_REF } from "../../src/schema"


const regions = [
    {
        name: "texas__offshore",
        comment: "Data from WorldSim icosahedral grid.  A rough area offshore from Texas, USA.",
    },
    {
        name: "texas",
        comment: "Data from WorldSim icosahedral grid.  A rough area of Texas, USA.",
    },
    {
        name: "united_kingdom__offshore",
        comment: "Data from WorldSim icosahedral grid.  A rough area offshore from UK.",
    },
    {
        name: "united_kingdom",
        comment: "Data from WorldSim icosahedral grid.  A rough area of UK.",
    },
]


const versions = [
    { value: "core@0.0.3", created: "2020-01-08 23:00:00 UTC", bundle: "main" },
    { value: "core@0.0.8", created: "2020-01-22 12:00:00 UTC", bundle: "regional" },
]


const region_instances: ATTRIBUTES = {}

regions.forEach(region => {
    const value_refs: VALUE_REF[] = versions.map(version => ({
        value_file: `regions/data/${region.name}@${version.value}.csv`,
        bundles: [version.bundle],
        columns: ["lat", "lon"],
        created: version.created,
        reference: "",
        sub_ref: "",
        comment: region.comment,
        meta_data: {
            units: {
                lat: "degree",
                lon: "degree"
            },
            params: {
                grid_divisions: 200
            }
        },
        data_sets: [version.value]
    }))

    region_instances[region.name] = {
        attributes: {
            latlons: {
                value_refs
            }
        }
    }
})


const regions_data: ATTRIBUTES = {
    regions: {
        attributes: {},
        instances: region_instances,
    }
}

export {
    regions_data
}
