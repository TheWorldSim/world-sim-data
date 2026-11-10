import { expect } from "chai"

import { parse_cellular_grid_csv_data, parse_latlon_grid_csv_data, type GridCsvData } from "./parse_data.ts"



const buses_csv = `bus_id,voltage,lon,lat
0,220,1,2
1,300,2,2
2,420,2,1
3,400,1,1
`

const ac_lines_csv = `line_id,bus0,bus1,voltage,s_nom,x_pu,geometry
0,0,1,225,503,3.53e-05,"LINESTRING (1 2, 2 2)"
1,1,2,400,1790,9.12e-05,"LINESTRING (2 2, 2 1)"
2,2,3,380,1700,1.59e-05,"LINESTRING (2 1, 1 1)"
`

const dc_links_csv = `link_id,bus0,bus1,voltage,p_nom,geometry
0,0,3,320,1000,"LINESTRING (1 2, 1 1)"
`

const demo_csv_data: GridCsvData = {
    buses: buses_csv,
    ac_lines: ac_lines_csv,
    dc_links: dc_links_csv,
}


describe("parse_grid_csv_data", () =>
{
    const grid = parse_latlon_grid_csv_data(demo_csv_data)

    it("parses all buses", () =>
    {
        expect(grid.buses).to.have.length(4)
    })

    it("parses bus ids as strings and lon, lat", () =>
    {
        expect(grid.buses).to.deep.equal([
            { id: "0", latlon: { lat: 2, lon: 1 } },
            { id: "1", latlon: { lat: 2, lon: 2 } },
            { id: "2", latlon: { lat: 1, lon: 2 } },
            { id: "3", latlon: { lat: 1, lon: 1 } },
        ])
    })

    it("parses all ac lines", () =>
    {
        expect(grid.ac_lines).to.have.length(3)
    })

    it("parses ac line endpoints, capacity, reactance and voltage", () =>
    {
        expect(grid.ac_lines).to.deep.equal([
            {
                id: "0",
                from_bus_id: "0",
                to_bus_id: "1",
                capacity_mw: 503,
                x_pu: 3.53e-05,
                voltage_kv: 225,
                path_latlon: [{ lat: 2, lon: 1 }, { lat: 2, lon: 2 }],
            },
            {
                id: "1",
                from_bus_id: "1",
                to_bus_id: "2",
                capacity_mw: 1790,
                x_pu: 9.12e-05,
                voltage_kv: 400,
                path_latlon: [{ lat: 2, lon: 2 }, { lat: 1, lon: 2 }],
            },
            {
                id: "2",
                from_bus_id: "2",
                to_bus_id: "3",
                capacity_mw: 1700,
                x_pu: 1.59e-05,
                voltage_kv: 380,
                path_latlon: [{ lat: 1, lon: 2 }, { lat: 1, lon: 1 }],
            },
        ])
    })

    it("parses ac line from and to bus ids that exist in the buses", () =>
    {
        const bus_ids = new Set(grid.buses.map(bus => bus.id))
        for (const line of grid.ac_lines)
        {
            expect(bus_ids.has(line.from_bus_id), `from_bus_id ${line.from_bus_id}`).to.equal(true)
            expect(bus_ids.has(line.to_bus_id), `to_bus_id ${line.to_bus_id}`).to.equal(true)
        }
    })

    it("parses all dc links", () =>
    {
        expect(grid.dc_links).to.have.length(1)
    })

    it("parses dc link endpoints, capacity and voltage", () =>
    {
        expect(grid.dc_links).to.deep.equal([
            {
                id: "0",
                from_bus_id: "0",
                to_bus_id: "3",
                capacity_mw: 1000,
                voltage_kv: 320,
                path_latlon: [{ lat: 2, lon: 1 }, { lat: 1, lon: 1 }],
            },
        ])
    })

    it("returns an empty grid for empty (header only) csv data", () =>
    {
        const empty_grid = parse_latlon_grid_csv_data({
            buses: "bus_id,voltage,x,y\n",
            ac_lines: "line_id,bus0,bus1,voltage,s_nom,x_pu,geometry\n",
            dc_links: "link_id,bus0,bus1,voltage,p_nom,geometry\n",
        })

        expect(empty_grid).to.deep.equal({ buses: [], ac_lines: [], dc_links: [] })
    })

    it("handles empty geometry for ac lines", () =>
    {
        const grid = parse_latlon_grid_csv_data({
            buses: `
                bus_id,voltage,lon,lat
                0,220,1,2
                1,300,2,2
            `,
            ac_lines: `
                line_id,bus0,bus1,voltage,s_nom,x_pu,geometry
                0,0,1,225,503,3.53e-05,""
                1,0,1,225,503,3.53e-05,
            `,
            dc_links: ``,
        })

        expect(grid.ac_lines[0]!.path_latlon).to.deep.equal([{ lon: 1, lat: 2 }, { lon: 2, lat: 2 }])
        expect(grid.ac_lines[1]!.path_latlon).to.deep.equal([{ lon: 1, lat: 2 }, { lon: 2, lat: 2 }])
    })

    it("handles POINT and LINESTRING geometry without duplicate points of buses", () =>
    {
        const grid = parse_latlon_grid_csv_data({
            buses: `
                bus_id,voltage,lon,lat
                0,220,1,2
                1,300,2,2
            `,
            ac_lines: `
                line_id,bus0,bus1,voltage,s_nom,x_pu,geometry
                0,0,1,225,503,3.53e-05,"['POINT (3 3)']"
                1,0,1,225,503,3.53e-05,"['POINT (1 2)']"
                2,0,1,225,503,3.53e-05,"LINESTRING (3 3, 4 4)"
                2,0,1,225,503,3.53e-05,"LINESTRING (3 3, 2 2)"
            `,
            dc_links: ``,
        })

        expect(grid.ac_lines[0]!.path_latlon).to.deep.equal([{ lon: 1, lat: 2 }, { lon: 3, lat: 3 }, { lon: 2, lat: 2 }])
        expect(grid.ac_lines[1]!.path_latlon).to.deep.equal([{ lon: 1, lat: 2 }, { lon: 2, lat: 2 }])
        expect(grid.ac_lines[2]!.path_latlon).to.deep.equal([{ lon: 1, lat: 2 }, { lon: 3, lat: 3 }, { lon: 4, lat: 4 }, { lon: 2, lat: 2 }])
        expect(grid.ac_lines[3]!.path_latlon).to.deep.equal([{ lon: 1, lat: 2 }, { lon: 3, lat: 3 }, { lon: 2, lat: 2 }])
    })
})


describe("parse_cellular_grid_csv_data", () =>
{
    it("can parse cellular grid csv data", () =>
    {
        const cellular_grid = parse_cellular_grid_csv_data({
            buses: `
                bus_id,voltage,cell_id
                0,220,8418655ffffffff
                1,300,8419697ffffffff
            `,
            ac_lines: `
                line_id,bus0,bus1,voltage,s_nom,x_pu,geometry
                0,0,1,225,503,3.53e-05,"8418655ffffffff, 8419697ffffffff"
            `,
            dc_links: `
                link_id,bus0,bus1,voltage,p_nom,geometry
                0,1,0,300,2000,"8419697ffffffff, 8418655ffffffff"
            `,
        })

        expect(cellular_grid.buses).to.have.length(2)
        expect(cellular_grid.ac_lines).to.have.length(1)
        expect(cellular_grid.dc_links).to.have.length(1)
    })
})
