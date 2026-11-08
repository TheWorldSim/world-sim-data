import { expect } from "chai"

import { aggregate_grid_to_cells } from "./aggregate_grid_to_cells.ts"
import { parse_grid_csv_data } from "./parse_data.ts"
import { latlon_to_from_cell_1dp } from "./latlon_to_from_cell.ts"



const buses_csv = `
bus_id,voltage,lon,lat
0,220,1,2
1,300,1.1,2.4
2,300,1,2.5
`

const ac_lines_csv = `
line_id,bus0,bus1,voltage,s_nom,x_pu,geometry
0,0,1,200,500,3e-05,"LINESTRING (1 2, 1.1 2.4)"
1,1,2,300,1700,9e-04,"LINESTRING (1.1 2.2, 1.3 2.4, 1 2.5)"
2,0,2,400,3500,1e-05,"LINESTRING (1 2, 1 2.5)"
`

const dc_links_csv = `
link_id,bus0,bus1,voltage,p_nom,geometry
0,0,1,200,1000,"LINESTRING (1 2, 1.1 2.4)"
1,1,2,300,2000,"LINESTRING (1.1 2.4, 1 2.5)"
2,0,2,400,3000,"LINESTRING (1 2, 1 2.5)"
`

const grid = parse_grid_csv_data({
    buses: buses_csv,
    ac_lines: ac_lines_csv,
    dc_links: dc_links_csv,
})


describe("aggregate_grid_to_cells", () =>
{
    const aggregated_grid = aggregate_grid_to_cells(grid, latlon_to_from_cell_1dp)

    it("aggregates all buses and merges by cell", () =>
    {
        expect(aggregated_grid.buses).to.have.length(2)
        expect(aggregated_grid.buses).to.deep.equal([
            { id: "0", cell_id: "2_1" },
            { id: "2", cell_id: "3_1" },
        ])
    })

    it("aggregates all ac lines locations to cell, removes lines going from and to same cell, does not merge other lines", () =>
    {
        const path_cell_ids = ["2_1", "3_1"]

        expect(aggregated_grid.ac_lines).to.have.length(2)
        expect(aggregated_grid.ac_lines).to.deep.equal([
            // line 0 removed as it goes from and to the same cell
            { id: "1", from_bus_id: "0", to_bus_id: "2", path_cell_ids, capacity_mw: 1700, x_pu: 9e-04, voltage_kv: 300 },
            { id: "2", from_bus_id: "0", to_bus_id: "2", path_cell_ids, capacity_mw: 3500, x_pu: 1e-05, voltage_kv: 400 },
        ])
    })

    it("aggregates all dc links locations to cell, removes links going from and to same cell, does not merge other links", () =>
    {
        const path1 = ["2_1", "3_1"]
        const path2 = ["2_1", "3_1"]

        expect(aggregated_grid.dc_links).to.have.length(2)
        expect(aggregated_grid.dc_links).to.deep.equal([
            // link 0 removed as it goes from and to the same cell
            {
                id: "1",
                from_bus_id: "0",
                to_bus_id: "2",
                path_cell_ids: path1,
                capacity_mw: 2000,
                voltage_kv: 300,
            },
            {
                id: "2",
                from_bus_id: "0",
                to_bus_id: "2",
                path_cell_ids: path2,
                capacity_mw: 3000,
                voltage_kv: 400,
            },
        ])
    })
})
