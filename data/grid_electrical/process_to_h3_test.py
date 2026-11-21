import io
import tempfile
import textwrap
import unittest
from pathlib import Path

import h3
import pandas as pd
from process_to_h3 import (H3_RESOLUTION, aggregate_grid_to_h3,
                           insert_intermediate_cells)

CELL_ID_COLUMN = "cell_id"
GEOMETRY_COLUMN = "geometry"

# Buses 0 and 1 are 70m apart so share a cell, bus 2 is ~60km away
BUS_0 = (54.059, -2.304)  # 8419553ffffffff
BUS_1 = (54.059, -2.305)
BUS_2 = (54.430, -2.544)  # 8419551ffffffff
# Adjacent to BUS0 and BUS_2 but in a different resolution 4 cell to both
BUS_3 = (54.334, -1.900)  # 841955bffffffff

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

    def test_fudge_cell_ids_are_mapped_for_buses_and_line_geometry(self):
        sea_cell_id = "8419481ffffffff"
        land_cell_id = "841948bffffffff"
        neighbour_cell_id = next(cell for cell in h3.grid_ring(sea_cell_id, 1) if cell != land_cell_id)
        sea_lat, sea_lon = h3.cell_to_latlng(sea_cell_id)
        neighbour_lat, neighbour_lon = h3.cell_to_latlng(neighbour_cell_id)

        buses_df = pd.DataFrame({"bus_id": [0, 1], "voltage": [400, 400], "lon": [sea_lon, neighbour_lon], "lat": [sea_lat, neighbour_lat]})
        lines_df = pd.DataFrame({
            "line_id": [0], "bus0": [0], "bus1": [1], "voltage": [400], "s_nom": [1000], "x_pu": [1e-4],
            GEOMETRY_COLUMN: [f"LINESTRING ({sea_lon} {sea_lat}, {neighbour_lon} {neighbour_lat})"],
        })
        links_df = pd.DataFrame(columns=["link_id", "bus0", "bus1", "voltage", "p_nom", GEOMETRY_COLUMN])

        aggregate_grid_to_h3(buses_df, lines_df, links_df, self.output_dir)

        self.assertEqual(
            self.read_records("buses.csv"),
            [
                {"bus_id": 0, "voltage": 400, CELL_ID_COLUMN: land_cell_id},
                {"bus_id": 1, "voltage": 400, CELL_ID_COLUMN: neighbour_cell_id},
            ],
        )
        self.assertEqual(
            self.read_records("lines.csv")[0][GEOMETRY_COLUMN],
            f"{land_cell_id}, {neighbour_cell_id}",
        )

    def test_loops_are_trimmed(self):
        # The DC link from UK to Denmark goes through the cell 8419403, briefly
        # enters 8419407, before passing back through 8419403.  Due to culling
        # repeated cells, this results in a very distorted path (most lines and
        # links are unsurprisingly straight-ish)
        bus_0 = { "lat": 53.28, "lon": 0.43 }  # Centre of 8419403ffffffff
        bus_1 = { "lat": 53.38, "lon": -0.19 } # Centre of 8419407ffffffff
        bus_2 = { "lat": 53.54, "lon": 0.83 }  # Centre of 841940bffffffff

        bus0str = f"{bus_0["lon"]} {bus_0["lat"]}"
        bus1str = f"{bus_1["lon"]} {bus_1["lat"]}"
        bus2str = f"{bus_2["lon"]} {bus_2["lat"]}"

        buses_df = pd.read_csv(io.StringIO(textwrap.dedent(f"""
        bus_id,voltage,lon,lat
        0,300,{bus_0["lon"]},{bus_0["lat"]}
        1,300,{bus_1["lon"]},{bus_1["lat"]}
        2,300,{bus_2["lon"]},{bus_2["lat"]}
        """)))

        lines_df = pd.read_csv(io.StringIO(textwrap.dedent(f"""
        line_id,bus0,bus1,voltage,s_nom,x_pu,geometry
        """)))

        links_df = pd.read_csv(io.StringIO(textwrap.dedent(f"""
        link_id,bus0,bus1,voltage,p_nom,geometry
        0,0,2,300,1000,"LINESTRING ({bus0str}, {bus1str}, {bus0str}, {bus2str})"
        1,0,2,300,1000,"LINESTRING ({bus0str}, {bus1str}, {bus0str}, {bus1str}, {bus2str})"
        """)))

        aggregate_grid_to_h3(buses_df, lines_df, links_df, self.output_dir)

        expected_cells = "8419403ffffffff, 841940bffffffff"
        self.assertEqual(
            self.read_records("links.csv"),
            [
                {"link_id": 0, "bus0": 0, "bus1": 2, "voltage": 300, "p_nom": 1000, GEOMETRY_COLUMN: expected_cells},
                {"link_id": 1, "bus0": 0, "bus1": 2, "voltage": 300, "p_nom": 1000, GEOMETRY_COLUMN: expected_cells},
            ],
        )


class TestInsertIntermediateCells(unittest.TestCase):
    def test_cells_at_most_max_step_apart_are_unchanged(self):
        cells = ["8419553ffffffff", "8419551ffffffff", "8419555ffffffff", "841955dffffffff"]

        self.assertEqual(insert_intermediate_cells(cells), cells)

    def test_cell_two_steps_away_on_diagonal_is_unchanged(self):
        # 8419553 and 8419555 are "diagonal" from each other, i.e. not adjacent
        # but have common neighbours and no intervening cell centres near the
        # line connecting them
        self.assertEqual(
            # https://h3geo.org/#hex=8419553ffffffff%2C+8419555ffffffff
            insert_intermediate_cells(["8419553ffffffff", "8419555ffffffff"]),
            ["8419553ffffffff", "8419555ffffffff"],
        )

    def test_cell_two_steps_away_with_intervening_cell_centre_gets_one_intermediate_cell(self):
        # 8419551 is in between from 8419553 and 841955d
        self.assertEqual(
            # https://h3geo.org/#hex=8419553ffffffff%2C+841955dffffffff
            insert_intermediate_cells(["8419553ffffffff", "841955dffffffff"]),
            ["8419553ffffffff", "8419551ffffffff", "841955dffffffff"],
        )

    def test_cell_five_steps_away_gets_three_intermediate_cells_including_a_diagonal(self):
        self.assertEqual(
            # https://h3geo.org/#hex=8419553ffffffff%2C+8419403ffffffff
            insert_intermediate_cells(["8419553ffffffff", "8419403ffffffff"]),
            # https://h3geo.org/#hex=8419553ffffffff%2C+8419421ffffffff%2C+8419405ffffffff%2C+8419403ffffffff
            ["8419553ffffffff", "8419421ffffffff", "8419405ffffffff", "8419403ffffffff"],
        )

    def test_every_step_is_at_most_max_step_apart_and_end_cells_are_kept(self):
        # https://h3geo.org/#hex=8419553ffffffff%2C+8419551ffffffff%2C+8419555ffffffff%2C+841955dffffffff%2C+8419543ffffffff%2C+8419403ffffffff
        cells = ["8419553ffffffff", "8419551ffffffff", "8419555ffffffff", "841955dffffffff", "8419543ffffffff", "8419403ffffffff"]

        result = insert_intermediate_cells(cells)

        self.assertEqual(result[0], cells[0])
        self.assertEqual(result[-1], cells[-1])
        for start, end in zip(result, result[1:]):
            self.assertLessEqual(h3.grid_distance(start, end), 2)

    def test_more_direct_path_insertion_made(self):
        # The cells 8419561, 8419505  https://h3geo.org/#hex=8419561ffffffff%2C+8419505ffffffff
        # have a more direct path through 8419563  https://h3geo.org/#hex=8419561ffffffff%2C+8419505ffffffff%2C+8419563ffffffff
        # instead of 841950d  https://h3geo.org/#hex=8419561ffffffff%2C+8419505ffffffff%2C+841950dffffffff
        self.assertEqual(
            insert_intermediate_cells(["8419561ffffffff", "8419505ffffffff"]),
            ["8419561ffffffff", "8419563ffffffff", "8419505ffffffff"],
        )


if __name__ == "__main__":
    unittest.main()
