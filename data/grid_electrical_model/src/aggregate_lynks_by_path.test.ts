import { expect } from "chai"

import { aggregate_lynks_by_path } from "./aggregate_lynks_by_path.ts"
import type { CellularLynk } from "./interface.ts"
import { parse_cellular_grid_csv_data } from "./parse_data.ts"
import { orthogonal_neighbour_cell_ids } from "./utils_test_helpers.ts"


describe("aggregate_lynks_by_path", () =>
{
    it("should merge lines and links with the same path", () =>
    {
        const cellular_grid = parse_cellular_grid_csv_data({
            buses: `
                bus_id,voltage,cell_id
                Bus1,300,a1
                Bus2,300,b1
                Bus3,300,c1
            `,
            ac_lines: `
                line_id,bus0,bus1,voltage,s_nom,x_pu,geometry
                0,Bus1,Bus2,300,1000,3e-05,
                1,Bus1,Bus2,300,1000,3e-05,
                2,Bus2,Bus1,300,1000,3e-05,
                3,Bus3,Bus1,300,1000,3e-05,b1
                4,Bus1,Bus3,300,1000,3e-05,b1
            `,
            dc_links: `
                link_id,bus0,bus1,voltage,p_nom,geometry
                0,Bus1,Bus2,300,2000,
                1,Bus1,Bus2,300,2000,
                2,Bus2,Bus1,300,2000,
                3,Bus3,Bus1,300,2000,b1
                4,Bus1,Bus3,300,2000,b1
            `,
        }, orthogonal_neighbour_cell_ids, { hop_capacity_MW: [100, 50] })

        const aggregated_lynks = aggregate_lynks_by_path(cellular_grid)

        expect(aggregated_lynks).deep.equals([
            {
                lynk_id: 0,
                path_cell_ids: ["a1", "b1"],
                capacity_mw: 15_000,
                ac_lines: [
                    { id: "0", direction:  1 },
                    { id: "1", direction:  1 },
                    { id: "2", direction: -1 },
                    { id: "3", direction: -1 },
                    { id: "4", direction:  1 },
                ],
                dc_links: [
                    { id: "0", direction:  1 },
                    { id: "1", direction:  1 },
                    { id: "2", direction: -1 },
                    { id: "3", direction: -1 },
                    { id: "4", direction:  1 },
                ],
            },
            {
                lynk_id: 1,
                path_cell_ids: ["c1", "b1"],
                capacity_mw: 6_000,
                ac_lines: [
                    { id: "3", direction:  1 },
                    { id: "4", direction: -1 },
                ],
                dc_links: [
                    { id: "3", direction:  1 },
                    { id: "4", direction: -1 },
                ],
            },
        ] satisfies CellularLynk[])
    })
})
