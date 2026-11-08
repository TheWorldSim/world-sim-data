import { expect } from "chai"

import {
    calculate_power_balance,
    type PoweredElectricalGrid,
} from "./power_balance.ts"
import type { LatLonElectricalGrid } from "./interface.ts"
import { parse_grid_csv_data } from "./parse_data.ts"
import { deep_approximate } from "./utils.ts"
import { latlon_to_from_cell_1dp } from "./latlon_to_from_cell.ts"
import { aggregate_grid_to_cells } from "./aggregate_grid_to_cells.ts"


const two_bus_grid: LatLonElectricalGrid = parse_grid_csv_data({
    buses: `
        bus_id,voltage,lon,lat
        0,220,0,0
        1,300,1,0
    `,
    ac_lines: `
        line_id,bus0,bus1,voltage,s_nom,x_pu,geometry
        0,0,1,400,1000,1e-4,
    `,
    dc_links: `
        link_id,bus0,bus1,voltage,p_nom,geometry
    `,
})


describe("calculate_power_balance", () =>
{
    it("returns an empty balance for an empty grid with no supply or demand", () =>
    {
        const args: PoweredElectricalGrid = {
            cellular_grid: { buses: [], ac_lines: [], dc_links: [] },
            demand_MW_by_cell: {},
            supply_MW_by_cell: {},
        }

        expect(calculate_power_balance(args)).to.deep.equal({
            MW_by_cell: {},
            MW_by_line: {},
            MW_by_link: {},
            status_by_cell: {},
        })
    })


    it("balances supply and demand across a connected two bus grid", () =>
    {
        const cellular_grid = aggregate_grid_to_cells(two_bus_grid, latlon_to_from_cell_1dp)
        const args: PoweredElectricalGrid = {
            cellular_grid,
            demand_MW_by_cell: { "0_0": 500 },
            supply_MW_by_cell: { "0_1": 500 },
        }

        const balance = calculate_power_balance(args)

        // Net balance: supply minus demand, so the generating cell exports and the load cell imports
        expect(balance.MW_by_cell["0_0"]).to.be.closeTo(-500, 1e-6)
        expect(balance.MW_by_cell["0_1"]).to.be.closeTo(500, 1e-6)

        expect(balance.status_by_cell).to.deep.equal({ "0_0": "demand_met", "0_1": "supplying" })
    })


    it("flags supply as curtailed by demand when there is more supply than demand", () =>
    {
        const cellular_grid = aggregate_grid_to_cells(two_bus_grid, latlon_to_from_cell_1dp)
        const balance = calculate_power_balance({
            cellular_grid,
            demand_MW_by_cell: { "0_0": 500 },
            supply_MW_by_cell: { "0_1": 800 },
        })

        expect(balance.MW_by_cell["0_0"]).to.be.closeTo(-500, 1e-6)
        expect(balance.MW_by_cell["0_1"]).to.be.closeTo(500, 1e-6)
        expect(balance.status_by_cell).to.deep.equal({ "0_0": "demand_met", "0_1": "supply_curtailed_by_demand" })
    })


    it("flags a cell with no net supply or demand as idle, including when supply and demand cancel", () =>
    {
        const cellular_grid = aggregate_grid_to_cells(two_bus_grid, latlon_to_from_cell_1dp)

        const balance_nothing = calculate_power_balance({ cellular_grid, demand_MW_by_cell: {}, supply_MW_by_cell: {} })
        expect(balance_nothing.status_by_cell).to.deep.equal({ "0_0": "idle", "0_1": "idle" })

        const balance_cancelled = calculate_power_balance({
            cellular_grid,
            demand_MW_by_cell: { "0_0": 300 },
            supply_MW_by_cell: { "0_0": 300 },
        })
        expect(balance_cancelled.status_by_cell).to.deep.equal({ "0_0": "idle", "0_1": "idle" })
    })


    it("flags supply and demand in a cell with no bus as curtailed by the grid and unmet", () =>
    {
        const cellular_grid = aggregate_grid_to_cells(two_bus_grid, latlon_to_from_cell_1dp)
        const balance = calculate_power_balance({
            cellular_grid,
            demand_MW_by_cell: { "5_5": 100 },
            supply_MW_by_cell: { "6_6": 100, "0_1": 100 },
        })

        expect(balance.status_by_cell["5_5"]).to.equal("demand_unmet")
        expect(balance.status_by_cell["6_6"]).to.equal("supply_curtailed_by_grid")
        // Demand elsewhere is unmet, so this supply is held back by the grid not by a lack of demand
        expect(balance.status_by_cell["0_1"]).to.equal("supply_curtailed_by_grid")
    })


    it("limits flow to the capacity of the line", () =>
    {
        const cellular_grid = aggregate_grid_to_cells(two_bus_grid, latlon_to_from_cell_1dp)
        const args: PoweredElectricalGrid = {
            cellular_grid,
            demand_MW_by_cell: { "0_0": 2000 },
            supply_MW_by_cell: { "0_1": 2000 },
        }

        const balance = calculate_power_balance(args)

        // Line capacity is 1000 MW, so only that can be delivered
        expect(balance.MW_by_cell["0_0"]).to.be.closeTo(-1000, 1e-6)
        expect(balance.MW_by_cell["0_1"]).to.be.closeTo(1000, 1e-6)

        expect(balance.status_by_cell).to.deep.equal({ "0_0": "demand_unmet", "0_1": "supply_curtailed_by_grid" })
    })


    it("handles cycles, DC, and dropped lines", () =>
    {
        const grid = parse_grid_csv_data({
            buses: `
                bus_id,voltage,lon,lat
                0,0,3,3
                1,0,2,2
                2,0,1,2
                3,0,2,1
                4,0,1,1
                5,0,1.5,0
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
        const cellular_grid = aggregate_grid_to_cells(grid, latlon_to_from_cell_1dp)

        const args: PoweredElectricalGrid = {
            cellular_grid,
            supply_MW_by_cell: { "3_3": 2000 },
            demand_MW_by_cell: { "1_1": 2000 },
        }

        const balance = calculate_power_balance(args)
        deep_approximate(balance, {
            MW_by_cell: {
                "3_3":  2000,
                "2_2":  0,
                "2_1":  0,
                "1_2":  0,
                "1_1": -2000,
                "0_2":  0,
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
            status_by_cell: {
                "3_3": "supplying",
                "2_2": "idle",
                "2_1": "idle",
                "1_2": "idle",
                "1_1": "demand_met",
                "0_2": "idle",
            },
        }, 1e-1)


        // Without the DC link, bus 0 is only reachable through line 0, which limits delivery to 1 GW
        const grid_without_dc_link = { ...grid, dc_links: [] }
        const cellular_grid_without_dc_link = aggregate_grid_to_cells(grid_without_dc_link, latlon_to_from_cell_1dp)
        const balance_without_dc_link = calculate_power_balance({ ...args, cellular_grid: cellular_grid_without_dc_link })
        deep_approximate(balance_without_dc_link, {
            MW_by_cell: {
                "3_3":  1000,
                "2_2":  0,
                "2_1":  0,
                "1_2":  0,
                "1_1": -1000,
                "0_2":  0,
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
            status_by_cell: {
                "3_3": "supply_curtailed_by_grid",
                "2_2": "idle",
                "2_1": "idle",
                "1_2": "idle",
                "1_1": "demand_unmet",
                "0_2": "idle",
            },
        }, 1e-1)


        // Without line 0 but with DC link 0 working, supply from bus 0 reaches bus 3 via DC link, then to demand at bus 4
        const grid_without_line_0 = {
            ...grid,
            ac_lines: grid.ac_lines.filter(line => line.id !== "0")
        }
        const cellular_grid_without_line_0 = aggregate_grid_to_cells(grid_without_line_0, latlon_to_from_cell_1dp)
        const balance_without_line_0 = calculate_power_balance({ ...args, cellular_grid: cellular_grid_without_line_0 })
        deep_approximate(balance_without_line_0, {
            MW_by_cell: {
                "3_3":  1000,
                "2_2":  0,
                "2_1":  0,
                "1_2":  0,
                "1_1": -1000,
                "0_2":  0,
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
            status_by_cell: {
                "3_3": "supply_curtailed_by_grid",
                "2_2": "idle",
                "2_1": "idle",
                "1_2": "idle",
                "1_1": "demand_unmet",
                "0_2": "idle",
            },
        }, 1e-1)
    })
})
