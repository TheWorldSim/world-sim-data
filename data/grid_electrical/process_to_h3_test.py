import io
import tempfile
import textwrap
import unittest
from pathlib import Path

import h3
import pandas as pd
from process_to_h3 import H3_RESOLUTION, aggregate_grid_to_h3

CELL_ID_COLUMN = "cell_id"
GEOMETRY_COLUMN = "geometry"

# Buses 0 and 1 are 100m apart so share a cell, bus 2 is ~110km away
BUS_0 = (53.426, -2.379)
BUS_1 = (53.427, -2.379)
BUS_2 = (53.598, -0.756)


def cell_id(latlon: tuple[float, float]) -> str:
    return h3.latlng_to_cell(*latlon, H3_RESOLUTION)


def build_buses_df() -> pd.DataFrame:
    csv_text = textwrap.dedent(f"""
    bus_id,voltage,lon,lat
    0,220,{BUS_0[1]},{BUS_0[0]}
    1,300,{BUS_1[1]},{BUS_1[0]}
    2,300,{BUS_2[1]},{BUS_2[0]}
    """)

    return pd.read_csv(io.StringIO(csv_text))


def build_lines_df() -> pd.DataFrame:
    csv_text = textwrap.dedent(f"""
    line_id,bus0,bus1,voltage,s_nom,x_pu,geometry
    0,0,1,200,500,3e-05,"LINESTRING (-2.379 53.426, -2.379 53.427)"
    1,1,2,300,1700,9e-04,"LINESTRING (-2.379 53.427, -2.379 53.426, -0.756 53.598)"
    2,0,2,400,3500,1.31e-05,"LINESTRING (-2.379 53.426, -0.756 53.598)"
    """)

    return pd.read_csv(io.StringIO(csv_text))


def build_links_df() -> pd.DataFrame:
    csv_text = textwrap.dedent(f"""
    link_id,bus0,bus1,voltage,p_nom,geometry
    0,0,1,200,1000,"LINESTRING (-2.379 53.426, -2.379 53.427)"
    1,1,2,300,2000,"LINESTRING (-2.379 53.427, -0.756 53.598)"
    2,0,2,400,3000,"LINESTRING (-2.379 53.426, -0.756 53.598)"
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


if __name__ == "__main__":
    unittest.main()
