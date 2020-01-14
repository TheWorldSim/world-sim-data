import { ATTRIBUTES } from "../../src/schema";

export const regions_data: ATTRIBUTES = {
    regions: {
        attributes: {},
        instances: {
            texas__offshore: {
                attributes: {
                    latlons: {
                        value_refs: [
                            {
                                value_file: "regions/texas__offshore@core@0.0.3-alpha.csv",
                                columns: ["lat", "lon"],
                                created: "2020-01-08 23:00:00 UTC",
                                reference: "",
                                sub_ref: "",
                                comment: "Data from WorldSim icosahedron grid.  A rough area offshore from Texas, USA.",
                                meta_data: {
                                    units: {
                                        lat: "degree",
                                        lon: "degree"
                                    },
                                    params: {
                                        grid_divisions: 200
                                    }
                                },
                                data_sets: ["core@0.0.3-alpha"]
                            }
                        ]
                    }
                }
            },
            texas: {
                attributes: {
                    latlons: {
                        value_refs: [
                            {
                                value_file: "regions/texas@core@0.0.3-alpha.csv",
                                columns: ["lat", "lon"],
                                created: "2020-01-08 23:00:00 UTC",
                                reference: "",
                                sub_ref: "",
                                comment: "Data from WorldSim icosahedron grid.  A rough area of Texas, USA.",
                                meta_data: {
                                    units: {
                                        lat: "degree",
                                        lon: "degree"
                                    },
                                    params: {
                                        grid_divisions: 200
                                    }
                                },
                                data_sets: ["core@0.0.3-alpha"]
                            }
                        ]
                    }
                }
            },
            united_kingdom__offshore: {
                attributes: {
                    latlons: {
                        value_refs: [
                            {
                                value_file: "regions/united_kingdom__offshore@core@0.0.3-alpha.csv",
                                columns: ["lat", "lon"],
                                created: "2020-01-08 23:00:00 UTC",
                                reference: "",
                                sub_ref: "",
                                comment: "Data from WorldSim icosahedron grid.  A rough area offshore from UK.",
                                meta_data: {
                                    units: {
                                        lat: "degree",
                                        lon: "degree"
                                    },
                                    params: {
                                        grid_divisions: 200
                                    }
                                },
                                data_sets: ["core@0.0.3-alpha"]
                            }
                        ]
                    }
                }
            },
            united_kingdom: {
                attributes: {
                    latlons: {
                        value_refs: [
                            {
                                value_file: "regions/united_kingdom@core@0.0.3-alpha.csv",
                                columns: ["lat", "lon"],
                                created: "2020-01-08 23:00:00 UTC",
                                reference: "",
                                sub_ref: "",
                                comment: "Data from WorldSim icosahedron grid.  A rough area of UK.",
                                meta_data: {
                                    units: {
                                        lat: "degree",
                                        lon: "degree"
                                    },
                                    params: {
                                        grid_divisions: 200
                                    }
                                },
                                data_sets: ["core@0.0.3-alpha"]
                            }
                        ]
                    }
                }
            },
        }
    }
}
