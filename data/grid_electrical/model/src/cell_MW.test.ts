import { expect } from "chai"

import { bus_MW_to_cell_MW, change_cell_MW, get_net_MW_by_cell } from "./cell_MW.ts"
import type { CellularElectricalGrid } from "./interface.ts"


describe("cell_MW", () =>
{
    describe("bus_MW_to_cell_MW", () =>
    {
        it("should sum the MW of buses which share a cell", () =>
        {
            const cell_id_by_bus_id: Record<string, string> = { bus1: "a1", bus2: "a1", bus3: "b1" }
            const cellular_grid = { bus_id_to_cell_id: (bus_id: string) => cell_id_by_bus_id[bus_id]! } as CellularElectricalGrid

            const MW_by_cell = bus_MW_to_cell_MW({ bus1: 100, bus2: 50, bus3: 30 }, cellular_grid)

            expect(MW_by_cell).deep.equals({ a1: 150, b1: 30 })
        })
    })

    describe("get_net_MW_by_cell", () =>
    {
        it("should net supply against demand for every cell in either", () =>
        {
            const net_MW_by_cell = get_net_MW_by_cell({
                supply_MW_by_cell_id: { a1: 100, b1: 0 },
                demand_MW_by_cell_id: { a1: 30, c1: 10 },
            })

            expect(net_MW_by_cell).deep.equals({ a1: 70, b1: 0, c1: -10 })
        })
    })

    describe("change_cell_MW", () =>
    {
        it("should add to supply for a positive change", () =>
        {
            const grid = { supply_MW_by_cell_id: { a1: 100 }, demand_MW_by_cell_id: {} }

            change_cell_MW(grid, "a1", 50)

            expect(grid).deep.equals({ supply_MW_by_cell_id: { a1: 150 }, demand_MW_by_cell_id: {} })
        })

        it("should reduce supply before increasing demand for a negative change", () =>
        {
            const grid = { supply_MW_by_cell_id: { a1: 100 }, demand_MW_by_cell_id: { a1: 0 } }

            change_cell_MW(grid, "a1", -30)

            expect(grid).deep.equals({ supply_MW_by_cell_id: { a1: 70 }, demand_MW_by_cell_id: { a1: 0 } })
        })

        it("should increase demand by the shortfall once supply is used up", () =>
        {
            const grid = { supply_MW_by_cell_id: { a1: 20 }, demand_MW_by_cell_id: { a1: 5 } }

            change_cell_MW(grid, "a1", -80)

            expect(grid).deep.equals({ supply_MW_by_cell_id: { a1: 0 }, demand_MW_by_cell_id: { a1: 65 } })
        })
    })
})
