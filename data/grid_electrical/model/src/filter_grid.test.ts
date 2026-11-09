import { expect } from "chai"

import { filter_grid } from "./filter_grid.ts"
import type { CommonACLine, CommonBus, CommonDCLink } from "./interface.ts"
import { parse_grid_csv_data } from "./parse_data.ts"


const buses_csv = `
bus_id,voltage,lon,lat
0,300,1,4
1,300,1,3
2,300,1,2
3,300,1,1
4,300,2,3
5,300,2,2
6,300,2,1
`

const ac_lines_csv = `
line_id,bus0,bus1,voltage,s_nom,x_pu,geometry
0,0,1,200,500,3e-05,
1,1,2,300,600,4e-05,
2,2,3,400,700,5e-05,
3,2,4,500,600,6e-05,
`

const dc_links_csv = `
link_id,bus0,bus1,voltage,p_nom,geometry
0,0,4,200,1000,
1,4,5,300,2000,
2,5,6,400,3000,
3,5,1,500,4000,
`

const grid = parse_grid_csv_data({
    buses: buses_csv,
    ac_lines: ac_lines_csv,
    dc_links: dc_links_csv,
})


describe("filter_grid", () =>
{
    it("should return the same grid when no filtering is applied", () =>
    {
        const filtered = filter_grid(grid, undefined)
        expect(filtered).to.deep.equal(grid)
    })

    it("should ignore lines, links and buses when a stop_bus_ids is reached", () =>
    {
        const filtered = filter_grid(grid, {
            start_bus_id: "0",
            stop_bus_ids: new Set(["2", "5"])
        })

        function ids(objs: (CommonBus[] | CommonACLine[] | CommonDCLink[]))
        {
            return objs.map(obj => obj.id)
        }

        expect(ids(filtered.buses)).deep.equals(["0", "1", "2", "4", "5"], "Should not contain bus ids 3 or 6")
        expect(ids(filtered.ac_lines)).deep.equals(["0", "1", "3"], "Should not contain line id 2")
        expect(ids(filtered.dc_links)).deep.equals(["0", "1", "3"], "Should not contain link id 2")
    })
})
