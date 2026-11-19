from collections import deque
from pathlib import Path

import h3
import pandas as pd
from shapely import wkt

H3_RESOLUTION = 4
CELL_ID_COLUMN = "cell_id"
GEOMETRY_COLUMN = "geometry"

BUS_FIELDS = ["bus_id", "voltage", CELL_ID_COLUMN]
LINE_FIELDS = ["line_id", "bus0", "bus1", "voltage", "s_nom", "x_pu", GEOMETRY_COLUMN]
LINK_FIELDS = ["link_id", "bus0", "bus1", "voltage", "p_nom", GEOMETRY_COLUMN]


def aggregate_grid_to_h3(buses_df: pd.DataFrame, lines_df: pd.DataFrame, links_df: pd.DataFrame, output_dir: Path):
    """
    Aggregate the grid data to H3 cells.

    Buses in the same cell are merged into the first bus seen in that cell.
    Lines and links are re-pointed at the merged buses, those starting and ending
    in the same cell are dropped, and their geometry becomes the cells they pass through.
    Consecutive geometry cells are adjacent or diagonal to each other, with intermediate cells inserted where needed.
    """
    output_dir.mkdir(parents=True, exist_ok=True)

    cell_ids = [h3.latlng_to_cell(lat, lon, H3_RESOLUTION) for lat, lon in zip(buses_df["lat"], buses_df["lon"])]
    buses_df = buses_df.assign(**{CELL_ID_COLUMN: cell_ids})

    merged_bus_ids = buses_df.groupby(CELL_ID_COLUMN)["bus_id"].transform("first")
    merged_bus_id_by_bus_id = pd.Series(merged_bus_ids.to_numpy(), index=buses_df["bus_id"])
    cell_id_by_bus_id = pd.Series(buses_df[CELL_ID_COLUMN].to_numpy(), index=buses_df["bus_id"])

    merged_buses_df = buses_df.drop_duplicates(CELL_ID_COLUMN)
    merged_buses_df[BUS_FIELDS].to_csv(output_dir / "buses.csv", index=False)

    aggregated_lines_df = _aggregate_edges(lines_df, merged_bus_id_by_bus_id, cell_id_by_bus_id)
    aggregated_lines_df[LINE_FIELDS].to_csv(output_dir / "lines.csv", index=False, float_format="%.15g")

    aggregated_links_df = _aggregate_edges(links_df, merged_bus_id_by_bus_id, cell_id_by_bus_id)
    aggregated_links_df[LINK_FIELDS].to_csv(output_dir / "links.csv", index=False, float_format="%.15g")


def _aggregate_edges(edges_df: pd.DataFrame, merged_bus_id_by_bus_id: pd.Series, cell_id_by_bus_id: pd.Series) -> pd.DataFrame:
    """
    Re-points lines / links at the merged buses, drops those within a single cell and converts geometry to cells.
    The geometry cells start and end at the cells of the merged buses.
    """
    # .loc raises a KeyError if an edge references an unknown bus
    edges_df = edges_df.assign(
        bus0=merged_bus_id_by_bus_id.loc[edges_df["bus0"]].to_numpy(),
        bus1=merged_bus_id_by_bus_id.loc[edges_df["bus1"]].to_numpy(),
    )
    edges_df = edges_df[edges_df["bus0"] != edges_df["bus1"]]
    geometries = [
        _linestring_to_cell_ids(linestring_wkt, cell_id_by_bus_id.loc[bus0], cell_id_by_bus_id.loc[bus1])
        for linestring_wkt, bus0, bus1 in zip(edges_df["geometry"], edges_df["bus0"], edges_df["bus1"])
    ]
    return edges_df.assign(**{GEOMETRY_COLUMN: geometries})


def _linestring_to_cell_ids(linestring_wkt: str, start_cell_id: str, end_cell_id: str) -> str:
    cell_ids = [h3.latlng_to_cell(lat, lon, H3_RESOLUTION) for lon, lat in wkt.loads(linestring_wkt).coords]
    # Bus cells are only listed at the start and end, so they are removed from the middle
    middle_cell_ids = dict.fromkeys(cell_id for cell_id in cell_ids if cell_id not in (start_cell_id, end_cell_id))
    return ", ".join(insert_intermediate_cells([start_cell_id, *middle_cell_ids, end_cell_id]))


def insert_intermediate_cells(cell_ids: list[str]) -> list[str]:
    """Inserts cells so that consecutive cells are adjacent or diagonal to each other (see _is_allowed_step)."""
    result = [cell_ids[0]]
    for start_cell_id, end_cell_id in zip(cell_ids, cell_ids[1:]):
        result.extend(_fewest_steps_path(start_cell_id, end_cell_id)[1:])
    return result


def _is_allowed_step(start_cell_id: str, end_cell_id: str) -> bool:
    """Returns True if the cells are adjacent or diagonal to each other."""
    distance = h3.grid_distance(start_cell_id, end_cell_id)
    if distance == 1:
        return True
    if distance == 2:
        # A straight pair two steps apart share one neighbour, the cell centre on the line between them.
        # A diagonal pair share two neighbours, so the line between them passes between cell centres.
        common_neighbour_ids = set(h3.grid_ring(start_cell_id, 1)) & set(h3.grid_ring(end_cell_id, 1))
        return len(common_neighbour_ids) == 2
    return False


def _fewest_steps_path(start_cell_id: str, end_cell_id: str) -> list[str]:
    parent_by_cell_id = {start_cell_id: None}
    queue = deque([start_cell_id])
    while queue:
        cell_id = queue.popleft()
        if cell_id == end_cell_id:
            break
        for next_cell_id in sorted(h3.grid_disk(cell_id, 2)):
            if next_cell_id not in parent_by_cell_id and _is_allowed_step(cell_id, next_cell_id):
                parent_by_cell_id[next_cell_id] = cell_id
                queue.append(next_cell_id)

    path = [end_cell_id]
    while path[-1] != start_cell_id:
        path.append(parent_by_cell_id[path[-1]])
    return path[::-1]
