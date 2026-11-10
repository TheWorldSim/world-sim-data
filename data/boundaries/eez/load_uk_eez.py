from pathlib import Path

import geopandas as gpd
from shapely import Polygon

uk_eez_path = Path(__file__).parent / "uk_eez.geojson"


def load_uk_eez() -> Polygon:
    """Load UK EEZ boundary from GeoJSON file as a single geometry."""
    gdf = gpd.read_file(uk_eez_path)
    return gdf.union_all() # type: ignore
    # return gdf.geometry.iloc[0]
