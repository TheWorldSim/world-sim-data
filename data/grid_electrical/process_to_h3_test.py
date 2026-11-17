import io
import tempfile
import textwrap
import unittest
from pathlib import Path

import h3
import pandas as pd
from process_to_h3 import MAX_CELL_STEP, H3_RESOLUTION, aggregate_grid_to_h3, insert_intermediate_cells

CELL_ID_COLUMN = "cell_id"
GEOMETRY_COLUMN = "geometry"

# Buses 0 and 1 are 100m apart so share a cell, bus 2 is ~110km away
BUS_0 = (54.059, -2.304)
BUS_1 = (54.059, -2.305)
BUS_2 = (54.430, -2.544)
# Adjacent to BUS0 and BUS_2 but in a different resolution 4 cell to both
BUS_3 = (54.334, -1.900)

BUS_0_str = f"{BUS_0[1]} {BUS_0[0]}"
BUS_1_str = f"{BUS_1[1]} {BUS_1[0]}"
BUS_2_str = f"{BUS_2[1]} {BUS_2[0]}"
BUS_3_str = f"{BUS_3[1]} {BUS_3[0]}"


def cell_id(latlon: tuple[float, float]) -> str:
    return h3.latlng_to_cell(*latlon, H3_RESOLUTION)


def build_buses_df() -> pd.DataFrame:
    csv_text = textwrap.dedent(f"""
    bus_id,voltage,lon,lat
    0,220,{BUS_0[1]},{BUS_0[0]}
    1,300,{BUS_1[1]},{BUS_1[0]}
    2,300,{BUS_2[1]},{BUS_2[0]}
    3,400,{BUS_3[1]},{BUS_3[0]}
    """)

    return pd.read_csv(io.StringIO(csv_text))


def build_lines_df() -> pd.DataFrame:
    csv_text = textwrap.dedent(f"""
    line_id,bus0,bus1,voltage,s_nom,x_pu,geometry
    0,0,1,200,500,3e-05,"LINESTRING ({BUS_0_str}, {BUS_1_str})"
    1,1,2,300,1700,9e-04,"LINESTRING ({BUS_1_str}, {BUS_0_str}, {BUS_2_str})"
    2,0,2,400,3500,1.31e-05,"LINESTRING ({BUS_0_str}, {BUS_2_str})"
    3,0,2,500,4000,2e-05,"LINESTRING ({BUS_0_str}, {BUS_2_str}, {BUS_0_str}, {BUS_2_str})"
    4,0,2,600,5000,3e-05,"LINESTRING ({BUS_2_str}, {BUS_3_str}, {BUS_0_str})"
    """)

    return pd.read_csv(io.StringIO(csv_text))


def build_links_df() -> pd.DataFrame:
    csv_text = textwrap.dedent(f"""
    link_id,bus0,bus1,voltage,p_nom,geometry
    0,0,1,200,1000,"LINESTRING ({BUS_0_str}, {BUS_1_str})"
    1,1,2,300,2000,"LINESTRING ({BUS_1_str}, {BUS_2_str})"
    2,0,2,400,3000,"LINESTRING ({BUS_0_str}, {BUS_2_str})"
    """)

    return pd.read_csv(io.StringIO(csv_text))


class TestAggregateGridToH3(unittest.TestCase):
    def setUp(self):
        temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(temp_dir.cleanup)
        # Does not exist yet to check the output dir is created
        self.output_dir = Path(temp_dir.name) / "h3"

        aggregate_grid_to_h3(build_buses_df(), build_lines_df(), build_links_df(), self.output_dir)

    def read_records(self, file_name: str) -> list[dict]:
        return pd.read_csv(self.output_dir / file_name).to_dict("records")

    def test_aggregates_all_buses_and_merges_by_cell(self):
        self.assertEqual(
            self.read_records("buses.csv"),
            [
                {"bus_id": 0, "voltage": 220, CELL_ID_COLUMN: cell_id(BUS_0)},
                {"bus_id": 2, "voltage": 300, CELL_ID_COLUMN: cell_id(BUS_2)},
                {"bus_id": 3, "voltage": 400, CELL_ID_COLUMN: cell_id(BUS_3)},
            ],
        )

    def test_aggregates_lines_to_cells_removes_lines_from_and_to_same_cell_does_not_merge_other_lines(self):
        cells = f"{cell_id(BUS_0)}, {cell_id(BUS_2)}"

        self.assertEqual(
            self.read_records("lines.csv"),
            [
                # line 0 removed as it goes from and to the same cell
                {"line_id": 1, "bus0": 0, "bus1": 2, "voltage": 300, "s_nom": 1700, "x_pu": 9e-04, GEOMETRY_COLUMN: cells},
                {"line_id": 2, "bus0": 0, "bus1": 2, "voltage": 400, "s_nom": 3500, "x_pu": 1.31e-05, GEOMETRY_COLUMN: cells},
                # line 3 revisits both cells, each cell only appears once in its geometry
                {"line_id": 3, "bus0": 0, "bus1": 2, "voltage": 500, "s_nom": 4000, "x_pu": 2e-05, GEOMETRY_COLUMN: cells},
                # line 4 starts and ends away from the bus cells and passes through bus 0's cell in the middle,
                # so the bus cells are placed at the ends and removed from the middle
                {
                    "line_id": 4,
                    "bus0": 0,
                    "bus1": 2,
                    "voltage": 600,
                    "s_nom": 5000,
                    "x_pu": 3e-05,
                    GEOMETRY_COLUMN: f"{cell_id(BUS_0)}, {cell_id(BUS_3)}, {cell_id(BUS_2)}",
                },
            ],
        )

    def test_aggregates_links_to_cells_removes_links_from_and_to_same_cell_does_not_merge_other_links(self):
        cells = f"{cell_id(BUS_0)}, {cell_id(BUS_2)}"

        self.assertEqual(
            self.read_records("links.csv"),
            [
                # link 0 removed as it goes from and to the same cell
                {"link_id": 1, "bus0": 0, "bus1": 2, "voltage": 300, "p_nom": 2000, GEOMETRY_COLUMN: cells},
                {"link_id": 2, "bus0": 0, "bus1": 2, "voltage": 400, "p_nom": 3000, GEOMETRY_COLUMN: cells},
            ],
        )

    def test_cell_ids_have_the_expected_h3_resolution(self):
        for record in self.read_records("buses.csv"):
            self.assertEqual(h3.get_resolution(record[CELL_ID_COLUMN]), H3_RESOLUTION)


class TestInsertIntermediateCells(unittest.TestCase):
    def test_cells_at_most_max_step_apart_are_unchanged(self):
        cells = ["8419553ffffffff", "8419551ffffffff", "8419555ffffffff", "841955dffffffff"]

        self.assertEqual(insert_intermediate_cells(cells), cells)

    def test_cell_three_steps_away_gets_one_intermediate_cell(self):
        # 8419551 and 8419557 are both one step from 8419553 and on a shortest path to 8419543, 8419551 sorts first
        self.assertEqual(
            insert_intermediate_cells(["8419553ffffffff", "8419543ffffffff"]),
            ["8419553ffffffff", "8419555ffffffff", "8419543ffffffff"],
        )

    def test_cell_five_steps_away_gets_two_intermediate_cells(self):
        self.assertEqual(
            insert_intermediate_cells(["8419553ffffffff", "8419403ffffffff"]),
            ["8419553ffffffff", "8419421ffffffff", "8419407ffffffff", "8419403ffffffff"],
        )

    def test_every_step_is_at_most_max_step_apart_and_end_cells_are_kept(self):
        cells = ["8419553ffffffff", "8419551ffffffff", "8419555ffffffff", "841955dffffffff", "8419543ffffffff", "8419403ffffffff"]

        result = insert_intermediate_cells(cells)

        self.assertEqual(result[0], cells[0])
        self.assertEqual(result[-1], cells[-1])
        for start, end in zip(result, result[1:]):
            self.assertLessEqual(h3.grid_distance(start, end), MAX_CELL_STEP)


if __name__ == "__main__":
    unittest.main()
