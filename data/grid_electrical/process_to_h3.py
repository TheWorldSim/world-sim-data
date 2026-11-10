from itertools import groupby
from pathlib import Path

import h3
import pandas as pd
from shapely import wkt

H3_RESOLUTION = 4
CELL_ID_COLUMN = f"h3r{H3_RESOLUTION}_cell_id"
GEOMETRY_COLUMN = f"h3r{H3_RESOLUTION}_geometry"

BUS_FIELDS = ["bus_id", "voltage", CELL_ID_COLUMN]
LINE_FIELDS = ["line_id", "bus0", "bus1", "voltage", "s_nom", "x_pu", GEOMETRY_COLUMN]
LINK_FIELDS = ["link_id", "bus0", "bus1", "voltage", "p_nom", GEOMETRY_COLUMN]


def aggregate_grid_to_h3(buses_df: pd.DataFrame, lines_df: pd.DataFrame, links_df: pd.DataFrame, output_dir: Path):
    """
    Aggregate the grid data to H3 cells.

    Buses in the same cell are merged into the first bus seen in that cell.
    Lines and links are re-pointed at the merged buses, those starting and ending
    in the same cell are dropped, and their geometry becomes the cells they pass through.
    """
    output_dir.mkdir(parents=True, exist_ok=True)

    cell_ids = [h3.latlng_to_cell(lat, lon, H3_RESOLUTION) for lat, lon in zip(buses_df["lat"], buses_df["lon"])]
    buses_df = buses_df.assign(**{CELL_ID_COLUMN: cell_ids})

    merged_bus_ids = buses_df.groupby(CELL_ID_COLUMN)["bus_id"].transform("first")
    merged_bus_id_by_bus_id = pd.Series(merged_bus_ids.to_numpy(), index=buses_df["bus_id"])

    merged_buses_df = buses_df.drop_duplicates(CELL_ID_COLUMN)
    merged_buses_df[BUS_FIELDS].to_csv(output_dir / "buses.csv", index=False)

    aggregated_lines_df = _aggregate_edges(lines_df, merged_bus_id_by_bus_id)
    aggregated_lines_df[LINE_FIELDS].to_csv(output_dir / "lines.csv", index=False, float_format="%.15g")

    aggregated_links_df = _aggregate_edges(links_df, merged_bus_id_by_bus_id)
    aggregated_links_df[LINK_FIELDS].to_csv(output_dir / "links.csv", index=False, float_format="%.15g")


def _aggregate_edges(edges_df: pd.DataFrame, merged_bus_id_by_bus_id: pd.Series) -> pd.DataFrame:
    """Re-points lines / links at the merged buses, drops those within a single cell and converts geometry to cells."""
    # .loc raises a KeyError if an edge references an unknown bus
    edges_df = edges_df.assign(
        bus0=merged_bus_id_by_bus_id.loc[edges_df["bus0"]].to_numpy(),
        bus1=merged_bus_id_by_bus_id.loc[edges_df["bus1"]].to_numpy(),
    )
    edges_df = edges_df[edges_df["bus0"] != edges_df["bus1"]]
    return edges_df.assign(**{GEOMETRY_COLUMN: edges_df["geometry"].map(_linestring_to_cell_ids)})


def _linestring_to_cell_ids(linestring_wkt: str) -> str:
    cell_ids = [h3.latlng_to_cell(lat, lon, H3_RESOLUTION) for lon, lat in wkt.loads(linestring_wkt).coords]
    # Consecutive points in the same cell collapse into one
    return ", ".join(cell_id for cell_id, _ in groupby(cell_ids))
