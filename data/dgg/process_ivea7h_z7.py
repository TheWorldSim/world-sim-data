from dataclasses import dataclass

import ipdb
import os
import sys
from typing import Literal, Type, TypeVar, Union, cast

import geopandas as gpd
import matplotlib.pyplot as plt
import mplcursors
import dggal
from shapely import LineString
from shapely.geometry import Point, Polygon, LinearRing

current_directory = os.path.dirname(os.path.abspath(__file__))
src_directory = os.path.abspath(current_directory + "/../../src")
data_directory = os.path.abspath(current_directory + "/../../data")
for path in [src_directory, data_directory]:
    if path not in sys.path:
        sys.path.append(path)


from constants import LAT_LON_LOW_RES_DP, IVEA7H_RESOLUTION
from boundaries.countries.process import get_boundaries


dgg_type = "ivea7h_z7"
def get_data_file_path(resolution: int) -> str:
    return os.path.join(current_directory, f"uk_eez_{dgg_type}_res_{resolution}.txt")

uk_eez = gpd.read_file(os.path.join(data_directory, "boundaries/eez/uk_eez.geojson"))
uk_land_polygons = get_boundaries().uk_all


# For the UK these zone IDs help shape the land mask to be more accurate and
# to ensure the areas of the DGG zones is about equal to the UK land polygons:
#    Area of UK land polygons: 33.095  (arbitrary units)
#    Area of zones marked as land: 33.062  (arbitrary units)
#    Area diff:  -0.033

# Set this to LAND_PROPORTION to something lower than 0.5 to mark zones as land
# if they have a smaller proportion of land than 50%.
LAND_PROPORTION = 0.5 # 0.471
LAND_PROPORTION_50_50 = 0.5

zone_ids_to_force_marking_as_land = {
    "00042541", # John o' Groats
    "00046100", # Portree & Raasay
    "00046162", # Tobermory & Kilchoan
    "00046232", # Port Logan
    "00046360", # Arran (the cell north west would be slightly better but would then join to mainland)
    "00065460", # Tirwedd Cenedlaethol Llŷn (Llŷn National Landscape)
    "00064450", # Penzance & St Ives
    "00065302", # Skegness
}


@dataclass
class ZoneData:
    zone_id: str
    lat: float
    lon: float
    is_land: bool
    has_some_land: bool

@dataclass
class ZonesData:
    resolution: int
    zones: list[ZoneData]


type RenderType = Literal["capcity_factor_masks", "land_use_mask"]

def process(resolution: int, render: RenderType):
    dggrs = get_dggrs()
    eez = uk_eez
    expand_eez = 0.5
    zones = get_dgg_zones(dggrs, resolution, eez, expand_eez, drop_zones_without_land=(render == "land_use_mask"))
    save_zones(zones)

    print(f"Number of DGGS zones covering the UK EEZ: {len(zones.zones)}")
    if (render == "land_use_mask"):
        print(f"Total marked as land: {sum(z.is_land for z in zones.zones)} (having some land: {sum(z.has_some_land for z in zones.zones)})")
        area_of_uk_land_polygons = sum(polygon.area for polygon in uk_land_polygons)
        area_of_h3_cells_marked_as_land = sum(get_zone_polygon(dggrs, z).area for z in zones.zones if z.is_land)
        print("Area of UK land polygons:", round(area_of_uk_land_polygons, 3))
        print("Area of DGGS zones marked as land:", round(area_of_h3_cells_marked_as_land, 3))
        print("Area diff: ", round(area_of_h3_cells_marked_as_land - area_of_uk_land_polygons, 3))
        # print("Area of DGGS zones marked as having some land:", round(sum(zone_polygon(dggrs, z).area for z in zones if z.has_some_land), 3))

    fig, ax = plt.subplots(figsize=(10, 10))
    add_eez_to_plot(ax, eez, expand_eez)
    add_land_to_plot(ax, uk_land_polygons)
    artists = add_zones_to_plot(dggrs, ax, zones)
    add_land_zones_to_plot(dggrs, ax, zones, render)

    attach_interactive_hover_annotations(dggrs, artists)
    plt.show()

# Attach interactive hover annotations showing the zone ID if mplcursors is available
def attach_interactive_hover_annotations(dggrs: dggal.IVEA7H_Z7, artists):
    def _on_add(sel):
        artist = sel.artist
        zone_id = getattr(artist, "_zone_id", None)
        if zone_id is None:
            print("Warning: Artist does not have a _zone_id attribute")
            return
        zone = get_zone_polygon(dggrs, zone_id)
        centroid = zone.centroid
        # Position the annotation at the zone centroid (data coords)
        sel.annotation.xy = (centroid.x, centroid.y)
        sel.annotation.set_text(zone_id or "")
        # ensure the annotation uses the same axes as the artist
        try:
            ax = artist.axes
            sel.annotation.axes = ax
        except Exception:
            pass
    if artists:
        mplcursors.cursor(artists, hover=True).connect("add", _on_add)


def get_dggrs() -> dggal.IVEA7H_Z7:
    app = dggal.Application(appGlobals=globals())
    dggal.pydggal_setup(app)
    # Create an IVEA7H_Z7 DGGS instance
    if dgg_type != "ivea7h_z7":
        raise ValueError(f"Unsupported DGGS type: {dgg_type}")
    return dggal.IVEA7H_Z7()


def get_dgg_zones(dggrs: dggal.IVEA7H_Z7, resolution: int, eez: gpd.GeoDataFrame, expand_eez: float, drop_zones_without_land: bool) -> ZonesData:
    # Build a GeoExtent from the EEZ bounding box
    eez_line_string: LineString = safe_cast(LineString, eez.geometry.iloc[0])
    eez_polygon = Polygon(eez_line_string.coords)
    eez_expanded_polygon = eez_polygon.buffer(expand_eez)
    # (minx, miny, maxx, maxy) come from (minlon, minlat, maxlon, maxlat)
    minx, miny, maxx, maxy = eez_line_string.bounds
    bbox = dggal.GeoExtent((miny, minx), (maxy, maxx))

    zones_impl = unsafe_cast(list[dggal.Z7Zone], dggrs.listZones(resolution, bbox))
    zones: list[ZoneData] = []
    for z in zones_impl:
        centroid = dggrs.getZoneWGS84Centroid(z)
        lat = centroid.lat.value
        lon = centroid.lon.value

        # Check that the lat lon are within the expanded EEZ polygon
        if not eez_expanded_polygon.contains(Point(lon, lat)):
            continue

        zone_polygon = get_zone_polygon(dggrs, z.getTextID())
        # Check that the zone overlaps with the normal EEZ polygon
        if not eez_polygon.intersects(zone_polygon):
            continue

        zone = ZoneData(zone_id=z.getTextID(), lat=lat, lon=lon, is_land=False, has_some_land=False)
        update_zone_over_land_stats(dggrs, zone, land_polygons=uk_land_polygons)

        if drop_zones_without_land and not zone.has_some_land:
            continue

        zones.append(zone)

    return ZonesData(resolution=resolution, zones=zones)


def update_zone_over_land_stats(dggrs: dggal.IVEA7H_Z7, zone: ZoneData, land_polygons: list[Polygon]):
    boundary = get_zone_polygon(dggrs, zone)
    is_land = any((land_polygon.intersection(boundary).area / boundary.area) >= LAND_PROPORTION for land_polygon in land_polygons)
    some_land = any((land_polygon.intersection(boundary).area / boundary.area) > 0 for land_polygon in land_polygons)
    zone.is_land = is_land or zone.zone_id in zone_ids_to_force_marking_as_land
    zone.has_some_land = zone.is_land or some_land


def save_zones(zones: ZonesData):
    zones.zones = sorted(zones.zones, key=lambda zone: zone.zone_id)
    resolution = zones.resolution
    with open(get_data_file_path(resolution), "w") as f:
        f.write(f"zone id, lat, lon, is land (L) or contains some land (l)\n")
        for zone in zones.zones:
            short_zone_id = zone.zone_id#[:7]
            lat, lon = (round(zone.lat, LAT_LON_LOW_RES_DP), round(zone.lon, LAT_LON_LOW_RES_DP))
            lat = round(lat, LAT_LON_LOW_RES_DP)
            lon = round(lon, LAT_LON_LOW_RES_DP)
            land = "L" if zone.is_land else ("l" if zone.has_some_land else "")
            f.write(f"{short_zone_id},{lat},{lon},{land}\n")


def load_zones(dggrs: dggal.IVEA7H_Z7, resolution: int) -> ZonesData:
    zones: list[ZoneData] = []
    with open(get_data_file_path(resolution), "r") as f:
        lines = f.readlines()[1:]
        for line in lines:
            zone_id, lat, lon, over_land = line.strip().split(",")
            zone = dggrs.getZoneFromTextID(zone_id)
            centroid = dggrs.getZoneWGS84Centroid(zone)
            lat = centroid.lat.value
            lon = centroid.lon.value
            is_land = over_land == "L"
            has_some_land = is_land or over_land == "l"
            zones.append(ZoneData(zone_id=zone_id, lat=lat, lon=lon, is_land=is_land, has_some_land=has_some_land))

    return ZonesData(resolution=resolution, zones=zones)


def add_eez_to_plot(ax, eez: gpd.GeoDataFrame, expand_eez: float):
    eez.plot(ax=ax, facecolor="blue", color="blue", alpha=0.1)
    eez_line_string: LineString = safe_cast(LineString, eez.geometry.iloc[0])
    eez_polygon = Polygon(eez_line_string.coords)
    eez_expanded_polygon = eez_polygon.buffer(expand_eez)

    expanded_eez_gdf = gpd.GeoDataFrame(geometry=[eez_expanded_polygon])
    # Plot the expanded EEZ polygon with a light blue outline and no fill and some transparency
    expanded_eez_gdf.plot(ax=ax, facecolor="none", edgecolor="lightblue", linewidth=1, alpha=0.5)


def add_land_to_plot(ax, land_polygons: list[Polygon]):
    land_gdf = gpd.GeoDataFrame(geometry=land_polygons)
    land_gdf.plot(ax=ax, color="gray")


def add_zones_to_plot(dggrs: dggal.IVEA7H_Z7, ax, zones: ZonesData):
    artists = []
    for zone in zones.zones:
        boundary = get_zone_polygon(dggrs, zone)
        x, y = zip(*boundary.exterior.coords)
        colour = "blue"
        line, = ax.plot(x, y, color=colour, linewidth=1, alpha=0.5)
        # store zone id on the artist for use by interactive cursors
        try:
            setattr(line, "_zone_id", zone.zone_id)
        except Exception:
            pass
        # also set a label fallback
        line.set_label(zone.zone_id)
        artists.append(line)

    return artists


def add_land_zones_to_plot(dggrs: dggal.IVEA7H_Z7, ax, zones: ZonesData, render: RenderType):
    for zone in zones.zones:
        boundary = get_zone_polygon(dggrs, zone)
        x, y = zip(*boundary.exterior.coords)
        if zone.is_land and render == "land_use_mask":
            color = "green"

            force_included = False
            for land_polygon in uk_land_polygons:
                land_overlap_ratio = (land_polygon.intersection(boundary).area / boundary.area)
                if (land_overlap_ratio >= LAND_PROPORTION_50_50) != (land_overlap_ratio >= LAND_PROPORTION):
                    force_included = True
                    break

            if (zone.zone_id in zone_ids_to_force_marking_as_land) or force_included:
                color = "lightgreen"

            ax.fill(x, y, color=color, alpha=0.5)
        elif zone.has_some_land:
            color = "yellow"
            ax.fill(x, y, color=color, alpha=0.25)


def get_zone_polygon(dggrs: dggal.IVEA7H_Z7, zone_or_id: Union[ZoneData, str]) -> Polygon:
    zone_id = zone_or_id.zone_id if isinstance(zone_or_id, ZoneData) else zone_or_id
    # zone.zone_id holds the implementation id string; attempt to cast to int
    z_impl = dggrs.getZoneFromTextID(zone_id)
    vertices = unsafe_cast(list[dggal.dggal.GeoPoint], dggrs.getZoneWGS84Vertices(z_impl))
    pts = []
    for p in vertices:
        lat = p.lat.value
        lon = p.lon.value
        pts.append((lon, lat))
    # ensure closed ring
    if pts and pts[0] != pts[-1]:
        pts.append(pts[0])
    return Polygon(LinearRing(pts))


T = TypeVar("T")
def safe_cast(cls: Type[T], obj: object) -> T:
    if not isinstance(obj, cls):
        raise TypeError(f"Expected {cls}, got {type(obj)}")
    return cast(T, obj)

unsafe_cast = cast


if __name__ == "__main__":
    process(IVEA7H_RESOLUTION, render="capcity_factor_masks")
    process(IVEA7H_RESOLUTION + 1, render="land_use_mask")
