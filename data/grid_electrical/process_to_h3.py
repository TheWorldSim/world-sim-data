from collections import deque
from pathlib import Path

import h3
import pandas as pd
from shapely import wkt

H3_RESOLUTION = 4
MAX_CELL_LOOP_SIZE = 1
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
    geometries = []
    for edge in edges_df.itertuples(index=False):
        linestring_wkt = str(edge.geometry)
        bus0 = edge.bus0
        bus1 = edge.bus1
        geometry = _linestring_to_cell_ids(linestring_wkt, cell_id_by_bus_id.loc[bus0], cell_id_by_bus_id.loc[bus1])
        geometries.append(geometry)

    return edges_df.assign(**{GEOMETRY_COLUMN: geometries})


def _linestring_to_cell_ids(linestring_wkt: str, start_cell_id: str, end_cell_id: str) -> str:
    cell_ids = [h3.latlng_to_cell(lat, lon, H3_RESOLUTION) for lon, lat in wkt.loads(linestring_wkt).coords]
    # Build path starting from start_cell_id and ending at end_cell_id
    # Keep all intermediate cells including duplicates for loop detection
    if cell_ids[0] == start_cell_id and cell_ids[-1] == end_cell_id:
        # Path already starts and ends at the right cells
        path_cells = cell_ids
    else:
        # Remove only the first and last cells from the extracted path to avoid duplication
        # but keep any repeats of start/end cells in the middle
        middle_cells = cell_ids[1:-1]
        path_cells = [start_cell_id, *middle_cells, end_cell_id]
    return ", ".join(insert_intermediate_cells(path_cells))


def insert_intermediate_cells(cell_ids: list[str]) -> list[str]:
    """Inserts cells so that consecutive cells are adjacent or diagonal to each other (see _is_allowed_step)."""
    result = [cell_ids[0]]
    for start_cell_id, end_cell_id in zip(cell_ids, cell_ids[1:]):
        result.extend(_fewest_steps_path(start_cell_id, end_cell_id)[1:])
    return _trim_loops(result)


def _trim_loops(cell_ids: list[str]) -> list[str]:
    """Removes cells that form small loops where repeated cells have
    MAX_CELL_LOOP_SIZE or fewer cells in between.

    When a repeated cell is found, all cells from the first occurrence to the repeat
    are marked as potentially part of a loop. This loop set expands as more repeats are found.
    Once we encounter a cell not in the loop set, we know the loop is complete.

    If the path ends with a cell in the loop (no cell after the loop), keep the unique cells.
    If there is a cell after the loop, trim the entire loop keeping only the starting cell.
    """
    result = []
    i = 0

    while i < len(cell_ids):
        cell_id = cell_ids[i]

        # Look for this cell repeating within MAX_CELL_LOOP_SIZE cells
        repeat_index = None
        for j in range(i + 1, min(i + MAX_CELL_LOOP_SIZE + 2, len(cell_ids))):
            if cell_ids[j] == cell_id:
                repeat_index = j
                break

        if repeat_index is None:
            # No repeat found, keep this cell
            result.append(cell_id)
            i += 1
        else:
            # Found a repeat within allowed distance - this is a loop
            # Collect all cells between first and repeat occurrence
            loop_cells = set(cell_ids[i:repeat_index + 1])
            loop_start = i
            loop_end = repeat_index

            # Expand the loop: include subsequent repeats of loop cells
            j = repeat_index + 1
            while j < len(cell_ids) and cell_ids[j] in loop_cells:
                loop_end = j
                j += 1

            # Check if there's a cell after the loop
            has_cell_after_loop = loop_end + 1 < len(cell_ids)

            if has_cell_after_loop:
                # There's a cell after the loop, so trim it - keep only the starting cell
                result.append(cell_id)
            else:
                # Path ends with the loop, keep unique cells in the loop in order
                seen = set()
                for k in range(loop_start, loop_end + 1):
                    cell = cell_ids[k]
                    if cell not in seen:
                        result.append(cell)
                        seen.add(cell)

            # Move past the loop
            i = loop_end + 1

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
    end_neighbors = set(h3.grid_ring(end_cell_id, 1))

    def sort_key(cell_id: str, current_cell: str) -> tuple:
        # Prefer cells adjacent to both current and target, then by ID
        current_ring = set(h3.grid_ring(current_cell, 1))
        is_on_direct_path = (cell_id in current_ring) and (cell_id in end_neighbors)
        return (not is_on_direct_path, cell_id)

    parent_by_cell_id = {start_cell_id: None}
    queue = deque([start_cell_id])
    visited = {start_cell_id}

    while queue:
        cell_id = queue.popleft()
        if cell_id == end_cell_id:
            break

        candidates = []
        for next_cell_id in h3.grid_disk(cell_id, 2):
            if next_cell_id not in visited and _is_allowed_step(cell_id, next_cell_id):
                candidates.append(next_cell_id)

        for next_cell_id in sorted(candidates, key=lambda c: sort_key(c, cell_id)):
            visited.add(next_cell_id)
            parent_by_cell_id[next_cell_id] = cell_id
            queue.append(next_cell_id)

    path = [end_cell_id]
    while path[-1] != start_cell_id:
        path.append(parent_by_cell_id[path[-1]])
    return path[::-1]
