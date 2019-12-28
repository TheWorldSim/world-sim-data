import { SCHEMA_0_1 } from "./schema"

const data: SCHEMA_0_1 = {
    "schema_version": "0.1",
    "data": {
        "wind_farms": {
            "instances": {
                "wildorado_wind_ranch": {
                    "attributes": {
                        "area": {
                            "value_refs": [
                                {
                                   "values": [6500],
                                   "columns": ["hectare"],
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
                            "_auto_values": [2.5123076923076924],
                            "_auto_columns": ["W m^-2"],
                            "data_sets": ["core@0.0.2"]
                        },
                        {
                            "values": [4.025],
                            "columns": ["W m^-2"],
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
    },
    "units": {
        "area": {
            "si": "m^2",
            "conversion": {
                "hectare": 10000,
                "km^2": 0.000001
            }
        },
        "power": {
            "si": "W",
            "conversion": {
                "MW": 0.000001
            }
        }
    },
    "data_sets": {
        "core": {
            "draft_version": "0.0.3",
            "release_version": "0.0.2",
            "_auto_versions": {
                "0.0.3": false,
                "0.0.2": true,
                "0.0.1": true
            }
        }
    }
}
