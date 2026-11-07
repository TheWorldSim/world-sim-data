import { expect } from "chai"

import {
    calculate_power_balance,
    type CalculatePowerBalanceArgs,
} from "./power_balance.ts"
import type { ILatLon, ElectricalGrid, LatLonToCell } from "./interface.ts"
import { parse_grid_csv_data } from "./parse_data.ts"
import { deep_approximate } from "./utils.ts"


// Simple 1 degree cells, e.g. "11,19"
const latlon_to_cell: LatLonToCell = {
    round_to_cell_centre: (latlon: ILatLon) => ({ lat: Math.round(latlon.lat), lon: Math.round(latlon.lon) }),
    to_cell_id: (latlon: ILatLon) => `${Math.round(latlon.lat)},${Math.round(latlon.lon)}`
}

const two_bus_grid: ElectricalGrid = parse_grid_csv_data({
    busses: `bus_id,voltage,lon,lat
0,220,0,0
1,300,1,0
`,
    ac_lines: `line_id,bus0,bus1,voltage,s_nom,x_pu,geometry
0,0,1,400,1000,1e-4,`,
    dc_links: `link_id,bus0,bus1,voltage,p_nom,geometry
`,
})


describe("calculate_power_balance", () =>
{
    it("returns an empty balance for an empty grid with no supply or demand", () =>
    {
        const args: CalculatePowerBalanceArgs = {
            electrical_grid: { busses: [], ac_lines: [], dc_links: [] },
            electrical_demand_GW_by_cell: {},
            electrical_supply_GW_by_cell: {},
            latlon_to_cell,
        }

        expect(calculate_power_balance(args)).to.deep.equal({
            GW_by_cell: {},
            MW_by_line: {},
            MW_by_link: {},
        })
    })


    it("balances supply and demand across a connected two bus grid", () =>
    {
        const args: CalculatePowerBalanceArgs = {
            electrical_grid: two_bus_grid,
            electrical_demand_GW_by_cell: { "0,0": 0.5 },
            electrical_supply_GW_by_cell: { "0,1": 0.5 },
            latlon_to_cell,
        }

        const balance = calculate_power_balance(args)

        // Net balance: supply minus demand, so the generating cell exports and the load cell imports
        expect(balance.GW_by_cell["0,0"]).to.be.closeTo(-0.5, 1e-6)
        expect(balance.GW_by_cell["0,1"]).to.be.closeTo(0.5, 1e-6)
    })


    it("limits flow to the capacity of the line", () =>
    {
        const args: CalculatePowerBalanceArgs = {
            electrical_grid: two_bus_grid,
            electrical_demand_GW_by_cell: { "0,0": 2 },
            electrical_supply_GW_by_cell: { "0,1": 2 },
            latlon_to_cell,
        }

        const balance = calculate_power_balance(args)

        // Line capacity is 1000 MW = 1 GW so only 1 GW can be delivered
        expect(balance.GW_by_cell["0,0"]).to.be.closeTo(-1, 1e-6)
        expect(balance.GW_by_cell["0,1"]).to.be.closeTo(1, 1e-6)
    })


    it("handles cycles, DC, and dropped lines", () =>
    {
        const electrical_grid = parse_grid_csv_data({
            busses: `
                bus_id,voltage,lon,lat
                0,0,3,3
                1,0,2,2
                2,0,1,2
                3,0,2,1
                4,0,1,1
                5,0,0.5,0
            `,
            ac_lines: `
                line_id,bus0,bus1,voltage,s_nom,x_pu,geometry
                0,0,1,400,1000,1e-4,
                1,1,2,400,1000,1e-4,
                2,1,3,400,1000,1e-4,
                3,2,4,400,1000,1e-4,
                4,3,4,400,1000,1e-4,
                5,3,5,400,1000,1e-4,
                6,4,5,400,1000,1e-4,
            `,
            dc_links: `
                link_id,bus0,bus1,voltage,p_nom,geometry
                0,0,3,400,1000,
            `,
        })

        const args: CalculatePowerBalanceArgs = {
            electrical_grid,
            electrical_supply_GW_by_cell: { "3,3": 2 },
            electrical_demand_GW_by_cell: { "1,1": 2 },
            latlon_to_cell,
        }

        const balance = calculate_power_balance(args)
        deep_approximate(balance, {
            GW_by_cell: {
                "3,3":  2,
                "2,2":  0,
                "2,1":  0,
                "1,2":  0,
                "1,1": -2,
                "0,1":  0,
            },
            MW_by_line: {
                0:  1000,
                1:  636.36,
                2:  363.636,
                3:  636.36,
                4:  909.09,
                5:  454.545,
                6: -454.545,
            },
            MW_by_link: {
                0: 1000,
            },
        }, 1e-1)


        // Without the DC link, bus 0 is only reachable through line 0, which limits delivery to 1 GW
        const grid_without_dc_link = { ...electrical_grid, dc_links: [] }
        const balance_without_dc_link = calculate_power_balance({ ...args, electrical_grid: grid_without_dc_link })
        deep_approximate(balance_without_dc_link, {
            GW_by_cell: {
                "3,3":  1,
                "2,2":  0,
                "2,1":  0,
                "1,2":  0,
                "1,1": -1,
                "0,1":  0,
            },
            MW_by_line: {
                0: 1000,
                1: 454.545,
                2: 545.455,
                3: 454.545,
                4: 363.636,
                5: 181.818,
                6: -181.818,
            },
            MW_by_link: {},
        }, 1e-1)


        // Without line 0 but with DC link 0 working, supply from bus 0 reaches bus 3 via DC link, then to demand at bus 4
        const grid_without_line_0 = {
            ...electrical_grid,
            ac_lines: electrical_grid.ac_lines.filter(line => line.id !== "0")
        }
        const balance_without_line_0 = calculate_power_balance({ ...args, electrical_grid: grid_without_line_0 })
        deep_approximate(balance_without_line_0, {
            GW_by_cell: {
                "3,3":  1,
                "2,2":  0,
                "2,1":  0,
                "1,2":  0,
                "1,1": -1,
                "0,1":  0,
            },
            MW_by_line: {
                1: 181.818,
                2: -181.818,
                3: 181.818,
                4: 545.45,
                5: 272.72,
                6: -272.72,
            },
            MW_by_link: {
                0: 1000,
            },
        }, 1e-1)
    })
})
