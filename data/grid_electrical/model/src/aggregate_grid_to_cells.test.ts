import { expect } from "chai"

import { aggregate_grid_to_cells } from "./aggregate_grid_to_cells.ts"
import { parse_grid_csv_data } from "./parse_data.ts"



const busses_csv = `bus_id,voltage,lon,lat
0,220,1,2
1,300,1.1,2.4
2,300,1,2.5
`

const ac_lines_csv = `line_id,bus0,bus1,voltage,s_nom,x_pu,geometry
0,0,1,200,500,3e-05,"LINESTRING (1 2, 1.1 2.4)"
1,1,2,300,1700,9e-04,"LINESTRING (1.1 2.2, 1.3 2.4, 1 2.5)"
2,0,2,400,3500,1e-05,"LINESTRING (1 2, 1 2.5)"
`

const dc_links_csv = `link_id,bus0,bus1,voltage,p_nom,geometry
0,0,1,200,1000,"LINESTRING (1 2, 1.1 2.4)"
1,1,2,300,2000,"LINESTRING (1.1 2.4, 1 2.5)"
2,0,2,400,3000,"LINESTRING (1 2, 1 2.5)"
`

const grid = parse_grid_csv_data({
    busses: busses_csv,
    ac_lines: ac_lines_csv,
    dc_links: dc_links_csv,
})


describe("aggregate_grid_to_cells", () =>
{
    const aggregated_grid = aggregate_grid_to_cells(grid, {
        round_to_cell_centre: (latlon) => ({ lat: Math.round(latlon.lat), lon: Math.round(latlon.lon) }),
        to_cell_id: (latlon) => `${Math.round(latlon.lat)}_${Math.round(latlon.lon)}`
    })

    it("aggregates all busses and merges by cell", () =>
    {
        expect(aggregated_grid.busses).to.have.length(2)
        expect(aggregated_grid.busses).to.deep.equal([
            { id: "0", latlon: { lon: 1, lat: 2 } },
            { id: "2", latlon: { lon: 1, lat: 3 } },
        ])
    })

    it("aggregates all ac lines locations to cell, removes lines going from and to same cell, does not merge other lines", () =>
    {
        const path = [{ lon: 1, lat: 2 }, { lon: 1, lat: 3 }]

        expect(aggregated_grid.ac_lines).to.have.length(2)
        expect(aggregated_grid.ac_lines).to.deep.equal([
            // line 0 removed as it goes from and to the same cell
            { from_bus_id: "0", to_bus_id: "2", path, capacity_mw: 1700, x_pu: 9e-04, voltage_kv: 300 },
            { from_bus_id: "0", to_bus_id: "2", path, capacity_mw: 3500, x_pu: 1e-05, voltage_kv: 400 },
        ])
    })

    it("aggregates all dc links locations to cell, removes links going from and to same cell, does not merge other links", () =>
    {
        const path1 = [{ lon: 1, lat: 2 }, { lon: 1, lat: 3 }]
        const path2 = [{ lon: 1, lat: 2 }, { lon: 1, lat: 3 }]

        expect(aggregated_grid.dc_links).to.have.length(2)
        expect(aggregated_grid.dc_links).to.deep.equal([
            // link 0 removed as it goes from and to the same cell
            { from_bus_id: "0", to_bus_id: "2", path: path1, capacity_mw: 2000, voltage_kv: 300 },
            { from_bus_id: "0", to_bus_id: "2", path: path2, capacity_mw: 3000, voltage_kv: 400 },
        ])
    })
})
