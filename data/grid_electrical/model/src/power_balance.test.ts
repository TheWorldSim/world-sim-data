import { expect } from "chai"

import { parse_cellular_grid_csv_data } from "./parse_data.ts"
import {
    calculate_power_balance,
    type PoweredCellularElectricalGrid,
} from "./power_balance.ts"
import { deep_approximate } from "./utils.ts"


// For these tests, we imagine an orthogonal grid where the cell_id is given
// by letters (horizontal position) and numbers (vertical) i.e.:
//     a   b   c   d   e   f   g   h
//  1  a1  b1  c1  d1  e1  f1  g1  h1
//  2  a2  b2  c2  d2  e2  f2  g2  h2
//  3  a3  b3  c3  d3  e3  f3  g3  h3
//  4  a4  b4  c4  d4  e4  f4  g4  h4

const neighbour_cell_ids = (cell_id: string): string[] =>
{
    const [, column, row_str] = cell_id.match(/^([a-z])(\d+)$/)!
    const row = parseInt(row_str!, 10)
    const column_code = column!.charCodeAt(0)
    return [
        `${String.fromCharCode((column_code - 1 + 26 - 97) % 26 + 97)}${row}`,
        `${String.fromCharCode((column_code + 1 + 26 - 97) % 26 + 97)}${row}`,
        `${column}${(row - 1 + 10) % 10}`,
        `${column}${(row + 1 + 10) % 10}`,
    ]
}

describe("calculate_power_balance", () =>
{
    describe("transmission grid - all nodes (buses) are connected", () =>
    {
        const two_bus_grid = parse_cellular_grid_csv_data({
            buses: `
                bus_id,voltage,cell_id
                Bus1,220,a4
                Bus2,300,b4
            `,
            ac_lines: `
                line_id,bus0,bus1,voltage,s_nom,x_pu,geometry
                0,Bus1,Bus2,400,1000,1e-4,
            `,
            dc_links: `
                link_id,bus0,bus1,voltage,p_nom,geometry
            `,
        }, neighbour_cell_ids, { hop_capacity_MW: [300, 50] })

        it("returns an empty balance for an empty grid with no supply or demand", () =>
        {
            const args: PoweredCellularElectricalGrid = {
                cellular_grid: {
                    buses: [],
                    ac_lines: [],
                    dc_links: [],
                    bus_id_to_cell_id: () => "",
                    distribution_grid: { buses: [], dc_links: [] },
                },
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
                demand_MW_by_cell_id: { "a4": 500 },
                supply_MW_by_cell_id: { "b4": 500 },
            }

            const balance = calculate_power_balance(args)

            // Net balance: supply minus demand, so the generating cell exports and the load cell imports
            expect(balance.MW_by_cell_id["a4"]).to.be.closeTo(-500, 1e-6)
            expect(balance.MW_by_cell_id["b4"]).to.be.closeTo(500, 1e-6)

            expect(balance.status_by_cell_id).to.deep.equal({ "a4": "demand_met", "b4": "supplying" })
        })


        it("flags supply as curtailed by demand when there is more supply than demand", () =>
        {
            const balance = calculate_power_balance({
                cellular_grid: two_bus_grid,
                demand_MW_by_cell_id: { "a4": 500 },
                supply_MW_by_cell_id: { "b4": 800 },
            })

            expect(balance.MW_by_cell_id["a4"]).to.be.closeTo(-500, 1e-6)
            expect(balance.MW_by_cell_id["b4"]).to.be.closeTo(500, 1e-6)
            expect(balance.status_by_cell_id).to.deep.equal({ "a4": "demand_met", "b4": "supply_curtailed_by_demand" })
        })


        it("flags a cell with no supply and no demand as idle", () =>
        {
            const balance_nothing = calculate_power_balance({ cellular_grid: two_bus_grid, demand_MW_by_cell_id: {}, supply_MW_by_cell_id: {} })
            expect(balance_nothing.status_by_cell_id).to.deep.equal({ "a4": "idle", "b4": "idle" })
        })


        it("flags a cell whose demand is exactly matched by its own supply as demand_met, not idle", () =>
        {
            const balance_cancelled = calculate_power_balance({
                cellular_grid: two_bus_grid,
                demand_MW_by_cell_id: { "a4": 300 },
                supply_MW_by_cell_id: { "a4": 300 },
            })
            expect(balance_cancelled.MW_by_cell_id["a4"]).to.be.closeTo(0, 1e-6)
            expect(balance_cancelled.status_by_cell_id).to.deep.equal({ "a4": "demand_met", "b4": "idle" })
        })


        it("flags a cell with zero demand and zero supply as idle, not demand_met", () =>
        {
            const balance = calculate_power_balance({
                cellular_grid: two_bus_grid,
                demand_MW_by_cell_id: { "a4": 0 },
                supply_MW_by_cell_id: { "a4": 0 },
            })
            expect(balance.status_by_cell_id).to.deep.equal({ "a4": "idle", "b4": "idle" })
        })


        it("flags insufficient supply", () =>
        {
            const balance = calculate_power_balance({
                cellular_grid: two_bus_grid,
                supply_MW_by_cell_id: { "a4": 100 },
                demand_MW_by_cell_id: { "b4": 200 },
            })

            expect(balance.status_by_cell_id["a4"]).to.equal("supplying")
            expect(balance.status_by_cell_id["b4"]).to.equal("demand_unmet_by_supply")
        })


        it("flags supply and demand in a cell with no bus as curtailed and unmet by the grid", () =>
        {
            const balance = calculate_power_balance({
                cellular_grid: two_bus_grid,
                demand_MW_by_cell_id: { "c1": 100 },
                supply_MW_by_cell_id: { "d1": 100 },
            })

            expect(balance.status_by_cell_id["c1"]).to.equal("demand_unmet_by_grid")
            expect(balance.status_by_cell_id["d1"]).to.equal("supply_curtailed_by_grid")
        })


        it("limits flow to the capacity of the line, marks supply curtailed by grid and demand unmet by grid", () =>
        {
            const args: PoweredCellularElectricalGrid = {
                cellular_grid: two_bus_grid,
                supply_MW_by_cell_id: { "a4": 2000 },
                demand_MW_by_cell_id: { "b4": 2000 },
            }

            const balance = calculate_power_balance(args)

            // Line capacity is 1000 MW, so only that can be delivered
            expect(balance.MW_by_cell_id["a4"]).to.be.closeTo(1000, 1e-6)
            expect(balance.MW_by_cell_id["b4"]).to.be.closeTo(-1000, 1e-6)

            expect(balance.status_by_cell_id).to.deep.equal({ "a4": "supply_curtailed_by_grid", "b4": "demand_unmet_by_grid" })
        })


        it("handles cycles, DC, and dropped lines", () =>
        {
            const cellular_grid = parse_cellular_grid_csv_data({
                buses: `
                    bus_id,voltage,cell_id
                    Bus1,0,a4
                    Bus2,0,b4
                    Bus3,0,c4
                    Bus4,0,d4
                    Bus5,0,e4
                    Bus6,0,f4
                `,
                ac_lines: `
                    line_id,bus0,bus1,voltage,s_nom,x_pu,geometry
                    0,Bus1,Bus2,400,1000,1e-4,
                    1,Bus2,Bus3,400,1000,1e-4,
                    2,Bus2,Bus4,400,1000,1e-4,
                    3,Bus3,Bus5,400,1000,1e-4,
                    4,Bus4,Bus5,400,1000,1e-4,
                    5,Bus4,Bus6,400,1000,1e-4,
                    6,Bus5,Bus6,400,1000,1e-4,
                `,
                dc_links: `
                    link_id,bus0,bus1,voltage,p_nom,geometry
                    0,Bus1,Bus4,400,1000,
                `,
            }, neighbour_cell_ids, { hop_capacity_MW: [300, 50] })

            const args: PoweredCellularElectricalGrid = {
                cellular_grid,
                supply_MW_by_cell_id: { "a4": 2000 },
                demand_MW_by_cell_id: { "e4": 2000 },
            }

            const balance = calculate_power_balance(args)
            deep_approximate(balance, {
                MW_by_cell_id: {
                    "a4":  2000,
                    "b4":  0,
                    "c4":  0,
                    "d4":  0,
                    "e4": -2000,
                    "f4":  0,
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
                    "a4": "supplying",
                    "b4": "idle",
                    "c4": "idle",
                    "d4": "idle",
                    "e4": "demand_met",
                    "f4": "idle",
                },
            }, 1e-1)


            // Without the DC link, bus 0 is only reachable through line 0, which limits delivery to 1 GW
            const grid_without_dc_link = { ...cellular_grid, dc_links: [] }
            const balance_without_dc_link = calculate_power_balance({ ...args, cellular_grid: grid_without_dc_link })
            deep_approximate(balance_without_dc_link, {
                MW_by_cell_id: {
                    "a4":  1000,
                    "b4":  0,
                    "c4":  0,
                    "d4":  0,
                    "e4": -1000,
                    "f4":  0,
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
                    "a4": "supply_curtailed_by_grid",
                    "b4": "idle",
                    "c4": "idle",
                    "d4": "idle",
                    "e4": "demand_unmet_by_grid",
                    "f4": "idle",
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
                    "a4":  1000,
                    "b4":  0,
                    "c4":  0,
                    "d4":  0,
                    "e4": -1000,
                    "f4":  0,
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
                    "a4": "supply_curtailed_by_grid",
                    "b4": "idle",
                    "c4": "idle",
                    "d4": "idle",
                    "e4": "demand_unmet_by_grid",
                    "f4": "idle",
                },
            }, 1e-1)
        })
    })


    describe("distribution grid - some nodes (buses) are not connected", () =>
    {
        const two_bus_grid = parse_cellular_grid_csv_data({
            buses: `
                bus_id,voltage,cell_id
                Bus1,220,d4
                Bus2,300,e4
            `,
            ac_lines: `
                line_id,bus0,bus1,voltage,s_nom,x_pu,geometry
                0,Bus1,Bus2,400,1000,1e-4,
            `,
            dc_links: `
                link_id,bus0,bus1,voltage,p_nom,geometry
            `,
        }, neighbour_cell_ids, { hop_capacity_MW: [300, 50] })

        it("should allow supply and demand from nodes to be used by nearest bus", () =>
        {
            const args: PoweredCellularElectricalGrid = {
                cellular_grid: two_bus_grid,
                supply_MW_by_cell_id: {
                    "a4": 200,
                    "b4": 200,
                    "c4": 200,
                    "d4": 200,
                },
                demand_MW_by_cell_id: {
                    "a4": 100,
                    "b4": 100,
                    "c4": 100,
                    "d4": 100,
                    "e4": 100,
                    "f4": 100,
                    "g4": 100,
                    "h4": 100,
                },
            }

            const balance = calculate_power_balance(args)

            deep_approximate(balance, {
                MW_by_cell_id: {
                    "a4": 0,     // no distribution grid connects from here
                    "b4": 50,    // insufficient distribution grid connects from here
                    "c4": 100,   // sufficient distribution grid connects from here
                    "d4": 100,   // sufficient transmission grid connects from here
                    "e4": -100,  // sufficient transmission grid reaches here
                    "f4": -100,  // sufficient distribution grid reaches here
                    "g4": -50,   // insufficient distribution grid reaches here
                    "h4": 0,     // no distribution grid reaches here
                },
                MW_by_line_id: {
                    "0": 250,
                },
                MW_by_link_id: {},
                status_by_cell_id: {
                    "a4": "supply_curtailed_by_grid",
                    "b4": "supply_curtailed_by_grid",
                    "c4": "supplying",
                    "d4": "supplying",
                    "e4": "demand_met",
                    "f4": "demand_met",
                    "g4": "demand_unmet_by_grid",
                    "h4": "demand_unmet_by_grid",
                },
            }, 1e-1)
        })


        it("should roll up supply and demand from nodes connected to each other and to the same nearest bus", () =>
        {
            const args: PoweredCellularElectricalGrid = {
                cellular_grid: two_bus_grid,
                supply_MW_by_cell_id: {
                    "b4": 50,
                    "c4": 0,
                    "d4": 300,
                },
                demand_MW_by_cell_id: {
                    "b4": 0,
                    "c4": 350,
                    "d4": 0,
                },
            }

            const balance = calculate_power_balance(args)

            deep_approximate(balance, {
                MW_by_cell_id: {
                    "b4": 50,
                    "c4": -350,
                    "d4": 300,
                    "e4": 0,
                },
                MW_by_line_id: {
                    "0": 0,
                },
                MW_by_link_id: {},
                status_by_cell_id: {
                    "b4": "supplying",
                    "c4": "demand_met",
                    "d4": "supplying",
                    "e4": "idle",
                },
            }, 1e-1)
        })
    })

    describe("multiple grids", () =>
    {
        it("should correctly handle multiple disconnected grids", () =>
        {
            const cellular_grid = parse_cellular_grid_csv_data({
                buses: `
                    bus_id,voltage,cell_id
                    Bus1,220,a4
                    Bus2,300,b4
                    Bus3,220,c1
                    Bus4,300,d1
                `,
                ac_lines: `
                    line_id,bus0,bus1,voltage,s_nom,x_pu,geometry
                    0,Bus1,Bus2,400,1000,1e-4,
                `,
                dc_links: `
                    link_id,bus0,bus1,voltage,p_nom,geometry
                    0,Bus3,Bus4,400,1000,
                `,
            }, neighbour_cell_ids, { hop_capacity_MW: [300, 50] })

            const balance = calculate_power_balance({
                cellular_grid,
                supply_MW_by_cell_id: {
                    "a4": 300,
                    "c1": 200,
                },
                demand_MW_by_cell_id: {
                    "b4": 200,
                    "d1": 300,
                },
            })

            deep_approximate(balance, {
                MW_by_cell_id: {
                    "a4": 200,
                    "b4": -200,
                    "c1": 200,
                    "d1": -200,
                },
                MW_by_line_id: {
                    "0": 200,
                },
                MW_by_link_id: {
                    "0": 200,
                },
                status_by_cell_id: {
                    "a4": "supply_curtailed_by_grid",
                    "b4": "demand_met",
                    "c1": "supplying",
                    "d1": "demand_unmet_by_grid",
                },
            }, 1e-1)
        })
    })
})
