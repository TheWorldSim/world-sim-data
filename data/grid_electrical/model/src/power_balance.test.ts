import { expect } from "chai"

import { parse_cellular_grid_csv_data } from "./parse_data.ts"
import {
    calculate_power_balance,
    type PoweredCellularElectricalGrid,
} from "./power_balance.ts"
import { deep_approximate } from "./utils.ts"


describe("calculate_power_balance", () =>
{

    const two_bus_grid = parse_cellular_grid_csv_data({
        buses: `
            bus_id,voltage,cell_id
            A0,220,abcedf1
            B1,300,ghijkl2
        `,
        ac_lines: `
            line_id,bus0,bus1,voltage,s_nom,x_pu,geometry
            0,A0,B1,400,1000,1e-4,
        `,
        dc_links: `
            link_id,bus0,bus1,voltage,p_nom,geometry
        `,
    })


    it("returns an empty balance for an empty grid with no supply or demand", () =>
    {
        const args: PoweredCellularElectricalGrid = {
            cellular_grid: { buses: [], ac_lines: [], dc_links: [], bus_id_to_cell_id: () => "" },
            demand_MW_by_cell_id: {},
            supply_MW_by_cell_id: {},
        }

        expect(calculate_power_balance(args)).to.deep.equal({
            MW_by_cell_id: {},
            MW_by_line_id: {},
            MW_by_link_id: {},
            status_by_cell_id: {},
        })
    })


    it("balances supply and demand across a connected two bus grid", () =>
    {
        const args: PoweredCellularElectricalGrid = {
            cellular_grid: two_bus_grid,
            demand_MW_by_cell_id: { "abcedf1": 500 },
            supply_MW_by_cell_id: { "ghijkl2": 500 },
        }

        const balance = calculate_power_balance(args)

        // Net balance: supply minus demand, so the generating cell exports and the load cell imports
        expect(balance.MW_by_cell_id["abcedf1"]).to.be.closeTo(-500, 1e-6)
        expect(balance.MW_by_cell_id["ghijkl2"]).to.be.closeTo(500, 1e-6)

        expect(balance.status_by_cell_id).to.deep.equal({ "abcedf1": "demand_met", "ghijkl2": "supplying" })
    })


    it("flags supply as curtailed by demand when there is more supply than demand", () =>
    {
        const balance = calculate_power_balance({
            cellular_grid: two_bus_grid,
            demand_MW_by_cell_id: { "abcedf1": 500 },
            supply_MW_by_cell_id: { "ghijkl2": 800 },
        })

        expect(balance.MW_by_cell_id["abcedf1"]).to.be.closeTo(-500, 1e-6)
        expect(balance.MW_by_cell_id["ghijkl2"]).to.be.closeTo(500, 1e-6)
        expect(balance.status_by_cell_id).to.deep.equal({ "abcedf1": "demand_met", "ghijkl2": "supply_curtailed_by_demand" })
    })


    it("flags a cell with no net supply or demand as idle, including when supply and demand cancel", () =>
    {
        const balance_nothing = calculate_power_balance({ cellular_grid: two_bus_grid, demand_MW_by_cell_id: {}, supply_MW_by_cell_id: {} })
        expect(balance_nothing.status_by_cell_id).to.deep.equal({ "abcedf1": "idle", "ghijkl2": "idle" })

        const balance_cancelled = calculate_power_balance({
            cellular_grid: two_bus_grid,
            demand_MW_by_cell_id: { "abcedf1": 300 },
            supply_MW_by_cell_id: { "abcedf1": 300 },
        })
        expect(balance_cancelled.status_by_cell_id).to.deep.equal({ "abcedf1": "idle", "ghijkl2": "idle" })
    })


    it("flags supply and demand in a cell with no bus as curtailed by the grid and unmet", () =>
    {
        const balance = calculate_power_balance({
            cellular_grid: two_bus_grid,
            demand_MW_by_cell_id: { "5_5": 100 },
            supply_MW_by_cell_id: { "6_6": 100, "ghijkl2": 100 },
        })

        expect(balance.status_by_cell_id["5_5"]).to.equal("demand_unmet")
        expect(balance.status_by_cell_id["6_6"]).to.equal("supply_curtailed_by_grid")
        // Demand elsewhere is unmet, so this supply is held back by the grid not by a lack of demand
        expect(balance.status_by_cell_id["ghijkl2"]).to.equal("supply_curtailed_by_grid")
    })


    it("limits flow to the capacity of the line", () =>
    {
        const args: PoweredCellularElectricalGrid = {
            cellular_grid: two_bus_grid,
            demand_MW_by_cell_id: { "abcedf1": 2000 },
            supply_MW_by_cell_id: { "ghijkl2": 2000 },
        }

        const balance = calculate_power_balance(args)

        // Line capacity is 1000 MW, so only that can be delivered
        expect(balance.MW_by_cell_id["abcedf1"]).to.be.closeTo(-1000, 1e-6)
        expect(balance.MW_by_cell_id["ghijkl2"]).to.be.closeTo(1000, 1e-6)

        expect(balance.status_by_cell_id).to.deep.equal({ "abcedf1": "demand_unmet", "ghijkl2": "supply_curtailed_by_grid" })
    })


    it("handles cycles, DC, and dropped lines", () =>
    {
        const cellular_grid = parse_cellular_grid_csv_data({
            buses: `
                bus_id,voltage,cell_id
                A0,0,aaaa1
                B1,0,bbbb2
                C2,0,cccc3
                D3,0,dddd4
                E4,0,eeee5
                F5,0,ffff6
            `,
            ac_lines: `
                line_id,bus0,bus1,voltage,s_nom,x_pu,geometry
                0,A0,B1,400,1000,1e-4,
                1,B1,C2,400,1000,1e-4,
                2,B1,D3,400,1000,1e-4,
                3,C2,E4,400,1000,1e-4,
                4,D3,E4,400,1000,1e-4,
                5,D3,F5,400,1000,1e-4,
                6,E4,F5,400,1000,1e-4,
            `,
            dc_links: `
                link_id,bus0,bus1,voltage,p_nom,geometry
                0,A0,D3,400,1000,
            `,
        })

        const args: PoweredCellularElectricalGrid = {
            cellular_grid,
            supply_MW_by_cell_id: { "aaaa1": 2000 },
            demand_MW_by_cell_id: { "eeee5": 2000 },
        }

        const balance = calculate_power_balance(args)
        deep_approximate(balance, {
            MW_by_cell_id: {
                "aaaa1":  2000,
                "bbbb2":  0,
                "cccc3":  0,
                "dddd4":  0,
                "eeee5": -2000,
                "ffff6":  0,
            },
            MW_by_line_id: {
                0:  1000,
                1:  636.36,
                2:  363.636,
                3:  636.36,
                4:  909.09,
                5:  454.545,
                6: -454.545,
            },
            MW_by_link_id: {
                0: 1000,
            },
            status_by_cell_id: {
                "aaaa1": "supplying",
                "bbbb2": "idle",
                "cccc3": "idle",
                "dddd4": "idle",
                "eeee5": "demand_met",
                "ffff6": "idle",
            },
        }, 1e-1)


        // Without the DC link, bus 0 is only reachable through line 0, which limits delivery to 1 GW
        const grid_without_dc_link = { ...cellular_grid, dc_links: [] }
        const balance_without_dc_link = calculate_power_balance({ ...args, cellular_grid: grid_without_dc_link })
        deep_approximate(balance_without_dc_link, {
            MW_by_cell_id: {
                "aaaa1":  1000,
                "bbbb2":  0,
                "cccc3":  0,
                "dddd4":  0,
                "eeee5": -1000,
                "ffff6":  0,
            },
            MW_by_line_id: {
                0: 1000,
                1: 454.545,
                2: 545.455,
                3: 454.545,
                4: 363.636,
                5: 181.818,
                6: -181.818,
            },
            MW_by_link_id: {},
            status_by_cell_id: {
                "aaaa1": "supply_curtailed_by_grid",
                "bbbb2": "idle",
                "cccc3": "idle",
                "dddd4": "idle",
                "eeee5": "demand_unmet",
                "ffff6": "idle",
            },
        }, 1e-1)


        // Without line 0 but with DC link 0 working, supply from bus 0 reaches bus 3 via DC link, then to demand at bus 4
        const grid_without_line_0 = {
            ...cellular_grid,
            ac_lines: cellular_grid.ac_lines.filter(line => line.id !== "0")
        }
        const balance_without_line_0 = calculate_power_balance({ ...args, cellular_grid: grid_without_line_0 })
        deep_approximate(balance_without_line_0, {
            MW_by_cell_id: {
                "aaaa1":  1000,
                "bbbb2":  0,
                "cccc3":  0,
                "dddd4":  0,
                "eeee5": -1000,
                "ffff6":  0,
            },
            MW_by_line_id: {
                1: 181.818,
                2: -181.818,
                3: 181.818,
                4: 545.45,
                5: 272.72,
                6: -272.72,
            },
            MW_by_link_id: {
                0: 1000,
            },
            status_by_cell_id: {
                "aaaa1": "supply_curtailed_by_grid",
                "bbbb2": "idle",
                "cccc3": "idle",
                "dddd4": "idle",
                "eeee5": "demand_unmet",
                "ffff6": "idle",
            },
        }, 1e-1)
    })
})
