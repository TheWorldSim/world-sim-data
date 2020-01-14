import { ATTRIBUTES } from "../../src/schema";

export const wind_farms_data: ATTRIBUTES = {
    wind_farms: {
        attributes: {
            nameplate_watts_per_square_meter: {
                value_refs: [
                    {
                        calculation: "wind_farms.wildorado_wind_ranch.nameplate_watts_per_square_meter",
                        created: "2020-01-08 23:00:00 UTC",
                        _manual_values: [[2.5123076923076924]],
                        _manual_columns: ["W m^-2"],
                        data_sets: ["core@0.0.2"]
                    },
                    {
                        values: [[4.025]],
                        columns: ["W m^-2"],
                        meta_data: { units: {}, params: {} },
                        created: "2020-01-08 23:00:00 UTC",
                        reference: "https://en.wikipedia.org/wiki/Wildorado_Wind_Ranch",
                        sub_ref: "",
                        comment: "Quick guess from numbers of: 161 MW / (3.2 x 12.5 km).",
                        data_sets: ["core@0.0.1"]
                    }
                ],
                labels: [
                    "wind_turbines",
                    "watts_per_square_meter"
                ],
                description: "wind turbines farm watts per square meter"
            }
        },
        instances: {
            wildorado_wind_ranch: {
                attributes: {
                    area: {
                        value_refs: [
                            {
                               values: [[6500]],
                               columns: ["hectare"],
                               meta_data: { units: {}, params: {} },
                               created: "2020-01-08 23:00:00 UTC",
                               reference: "https://en.wikipedia.org/wiki/Wildorado_Wind_Ranch",
                               sub_ref: "",
                               comment: "",
                               data_sets: ["core@0.0.2"]
                            }
                        ]
                    },
                    turbines: {
                        attributes: {
                            count: {
                                value_refs: [
                                    {
                                       values: [[71]],
                                       columns: [""],
                                       meta_data: { units: {}, params: {} },
                                       created: "2020-01-08 23:00:00 UTC",
                                       reference: "https://en.wikipedia.org/wiki/Wildorado_Wind_Ranch",
                                       sub_ref: "",
                                       comment: "",
                                       data_sets: ["core@0.0.2"]
                                    }
                                ]
                            },
                            power: {
                                value_refs: [
                                    {
                                       values: [[2.3]],
                                       columns: ["MW"],
                                       meta_data: { units: {}, params: {} },
                                       created: "2020-01-08 23:00:00 UTC",
                                       reference: "https://en.wikipedia.org/wiki/Wildorado_Wind_Ranch",
                                       sub_ref: "",
                                       comment: "",
                                       data_sets: ["core@0.0.2"]
                                    }
                                ]
                            }
                        }
                    },
                    nameplate_generation: {
                        value_refs: [
                            {
                                calculation: "wind_farms.wildorado_wind_ranch.turbines.count * wind_farms.wildorado_wind_ranch.turbines.power",
                                created: "2020-01-08 23:00:00 UTC",
                                _manual_values: [[163300000]],
                                _manual_columns: ["W"],
                                data_sets: ["core@0.0.2"]
                            }
                        ]
                    },
                    nameplate_watts_per_square_meter: {
                        value_refs: [
                            {
                                calculation: "wind_farms.wildorado_wind_ranch.nameplate_generation / wind_farms.wildorado_wind_ranch.area",
                                created: "2020-01-08 23:00:00 UTC",
                                _manual_values: [[2.5123076923076924]],
                                _manual_columns: ["W m^-2"],
                                data_sets: ["core@0.0.2"]
                            }
                        ]
                    }
                }
            }
        }
    }
}
