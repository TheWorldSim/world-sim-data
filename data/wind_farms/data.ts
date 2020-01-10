import { ATTRIBUTES } from "../../src/schema";

export const wind_farms_data: ATTRIBUTES = {
    "wind_farms": {
        "instances": {
            "wildorado_wind_ranch": {
                "attributes": {
                    "area": {
                        "value_refs": [
                            {
                               "values": [6500],
                               "columns": ["hectare"],
                               "created": "2020-01-08 23:00:00 UTC",
                               "reference": "https://en.wikipedia.org/wiki/Wildorado_Wind_Ranch",
                               "data_sets": ["core@0.0.2"]
                            }
                        ]
                    },
                    "turbines": {
                        "attributes": {
                            "count": {
                                "value_refs": [
                                    {
                                       "values": [71],
                                       "created": "2020-01-08 23:00:00 UTC",
                                       "reference": "https://en.wikipedia.org/wiki/Wildorado_Wind_Ranch",
                                       "data_sets": ["core@0.0.2"]
                                    }
                                ]
                            },
                            "power": {
                                "value_refs": [
                                    {
                                       "values": [2.3],
                                       "columns": ["MW"],
                                       "created": "2020-01-08 23:00:00 UTC",
                                       "reference": "https://en.wikipedia.org/wiki/Wildorado_Wind_Ranch",
                                       "data_sets": ["core@0.0.2"]
                                    }
                                ]
                            }
                        }
                    },
                    "nameplate_generation": {
                        "value_refs": [
                            {
                                "calculation": "wind_farms.wildorado_wind_ranch.turbines.count * wind_farms.wildorado_wind_ranch.turbines.power",
                                "created": "2020-01-08 23:00:00 UTC",
                                "_auto_values": [163300000],
                                "_auto_columns": ["W"],
                                "data_sets": ["core@0.0.2"]
                            }
                        ]
                    },
                    "nameplate_watts_per_square_meter": {
                        "value_refs": [
                            {
                                "calculation": "wind_farms.wildorado_wind_ranch.nameplate_generation / wind_farms.wildorado_wind_ranch.area",
                                "created": "2020-01-08 23:00:00 UTC",
                                "_auto_values": [2.5123076923076924],
                                "_auto_columns": ["W m^-2"],
                                "data_sets": ["core@0.0.2"]
                            }
                        ]
                    }
                }
            }
        },
        "attributes": {
            "nameplate_watts_per_square_meter": {
                "value_refs": [
                    {
                        "calculation": "wind_farms.wildorado_wind_ranch.nameplate_watts_per_square_meter",
                        "created": "2020-01-08 23:00:00 UTC",
                        "_auto_values": [2.5123076923076924],
                        "_auto_columns": ["W m^-2"],
                        "data_sets": ["core@0.0.2"]
                    },
                    {
                        "values": [4.025],
                        "columns": ["W m^-2"],
                        "created": "2020-01-08 23:00:00 UTC",
                        "reference": "https://en.wikipedia.org/wiki/Wildorado_Wind_Ranch",
                        "comment": "Quick guess from numbers of: 161 MW / (3.2 x 12.5 km).",
                        "data_sets": ["core@0.0.1"]
                    }
                ],
                "labels": [
                    "wind_turbines",
                    "watts_per_square_meter"
                ],
                "description": "wind turbines farm watts per square meter"
            }
        }
    }
}
