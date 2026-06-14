import typing


# Copied from https://wikisim.org/wiki/1259v1
map_class_number_to_name = {
    1: "Broadleaved woodland",
    2: "Coniferous Woodland",
    3: "Arable and Horticulture",
    4: "Improved Grassland",
    5: "Neutral Grassland",
    6: "Calcareous Grassland",
    7: "Acid grassland",
    8: "Fen, Marsh and Swamp",
    9: "Heather",
    10: "Heather grassland",
    11: "Bog",
    12: "Inland Rock",
    13: "Saltwater",
    14: "Freshwater",
    15: "Supralittoral Rock",
    16: "Supralittoral Sediment",
    17: "Littoral Rock",
    18: "Littoral sediment",
    19: "Saltmarsh",
    20: "Urban",
    21: "Suburban"
}


SimplifiedAreaType = typing.Literal[
    "woodland",
    "arable",
    "grassland",
    "wetland",
    "rock",
    "inland_water",
    "urban",
    "suburban"
]



# Copied between:
# https://wikisim.org/wiki/1261v5 (in the code)
# https://github.com/AJamesPhillips/energy-explorer-v2/blob/c7f2921/src/sim_3d/data/coverage_land/uk/data.ts#L167-L189
# and https://github.com/theWorldSim/world-sim-data/tree/master/data/land_coverage/uk/process.py
map_class_name_to_simplified_area_type: dict[str, SimplifiedAreaType] = {
    "Broadleaved woodland": "woodland",
    "Coniferous Woodland": "woodland",
    "Arable and Horticulture": "arable",
    "Improved Grassland": "grassland",
    "Neutral Grassland": "grassland",
    "Calcareous Grassland": "grassland",
    "Acid grassland": "grassland",
    "Fen, Marsh and Swamp": "wetland",
    "Heather": "grassland",
    "Heather grassland": "grassland",
    "Bog": "wetland",
    "Inland Rock": "rock",
    "Saltwater": "inland_water",
    "Freshwater": "inland_water",
    "Supralittoral Rock": "rock",
    "Supralittoral Sediment": "rock",
    "Littoral Rock": "rock",
    "Littoral sediment": "rock",
    "Saltmarsh": "wetland",
    "Urban": "urban",
    "Suburban": "suburban"
}


map_class_number_to_simplified_area_type: dict[int, SimplifiedAreaType] = {
    class_number: map_class_name_to_simplified_area_type[class_name]
    for class_number, class_name in map_class_number_to_name.items()
}
