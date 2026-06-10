from dataclasses import dataclass
import ipdb
import os
import sys

import geopandas as gpd
import matplotlib.pyplot as plt
from shapely.geometry import LineString, MultiLineString, Polygon


current_directory = os.path.dirname(os.path.abspath(__file__))
src_directory = os.path.abspath(current_directory + "/../../../src")
if src_directory not in sys.path:
    sys.path.append(src_directory)

from geo_utils import safe_join_linestrings


country_50m_file_path = current_directory + "/countries_50m.json"


def process():
    boundaries = get_boundaries()
    fg, ax = plt.subplots(figsize=(8,8))
    ax.plot(*boundaries.uk_mainland.exterior.xy, color="blue")
    ax.plot(*boundaries.ni.exterior.xy, color="blue")
    ax.plot(*boundaries.ie.exterior.xy, color="green")
    ax.plot(*boundaries.ie_gb_nri_boundary.xy, color="yellow")
    ax.plot(*boundaries.fr.exterior.xy, color="red")
    plt.show()


def get_boundaries():
    # Other layer is "land"
    df = gpd.read_file(country_50m_file_path, layer="countries")
    uk_df = df[df["name"] == "United Kingdom"]
    ie_df = df[df["name"] == "Ireland"]
    fr_df = df[df["name"] == "France"]

    uk_geoms = uk_df["geometry"].values[0].geoms
    ie_geoms = ie_df["geometry"].values[0].geoms
    fr_geoms = fr_df["geometry"].values[0].geoms

    # Order the geometries by area size
    uk_geoms = sorted(uk_geoms, key=lambda geom: geom.area, reverse=True)
    ie_geoms = sorted(ie_geoms, key=lambda geom: geom.area, reverse=True)
    fr_geoms = sorted(fr_geoms, key=lambda geom: geom.area, reverse=True)

    uk_mainland: Polygon = uk_geoms[0]
    ni: Polygon = uk_geoms[1]
    ie: Polygon = ie_geoms[0]
    fr: Polygon = fr_geoms[0]

    # Pairwise exact match
    ie_gb_nri_multiline: MultiLineString = ni.boundary.intersection(ie.boundary) # type: ignore
    ie_gb_nri_boundary = safe_join_linestrings(ie_gb_nri_multiline.geoms) # type: ignore

    @dataclass
    class Boundaries:
        uk_mainland: Polygon
        ni: Polygon
        uk_all: list[Polygon]
        ie: Polygon
        fr: Polygon
        ie_gb_nri_boundary: LineString

    return Boundaries(
        uk_mainland=uk_mainland,
        ni=ni,
        uk_all=uk_geoms,
        ie=ie,
        fr=fr,
        ie_gb_nri_boundary=ie_gb_nri_boundary,
    )


if __name__ == "__main__":
    process()
