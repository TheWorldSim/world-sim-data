import { expect } from "chai"

import { build_distribution_grid } from "./build_distribution_grid.ts"
import type { CellularBus, CommonBus, DistributionGridConfig } from "./interface.ts"


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

describe("build_distribution_grid", () =>
{
    it("should return empty distribution for no config", () =>
    {
        const buses: CommonBus[] = [{ id: "Bus1" }]
        const result = build_distribution_grid(buses, undefined, undefined)
        expect(result).to.deep.equal({ buses: [], dc_links: [], cell_ids: [] })
    })

    it("should connect non-bus cells to nearest bus with breadth-first search", () =>
    {
        const buses: CellularBus[] = [
            { id: "Bus1", cell_id: "d4" },
        ]
        const config: DistributionGridConfig = {
            hop_capacity_MW: [300, 100],
        }

        const result = build_distribution_grid(buses, neighbour_cell_ids, config)

        // d4 is the bus, its neighbours are c4, d3, d5, and e4, and they in
        // turn will connect to 8 more cells
        expect(result.cell_ids).to.include.members(["c4", "d3", "d5", "e4", "b4", "c3", "c5", "d2", "e3", "d6", "e5", "f4"])

        // Each cell should have one DC link to its parent
        expect(result.dc_links.length).to.equal(12)
        expect(result.dc_links[0]).to.deep.equal({
            id: "distribution:c4->Bus1",
            from_bus_id: "distribution:c4",
            to_bus_id: "Bus1",
            capacity_mw: 300,
            voltage_kv: 0,
        })
        expect(result.buses.length).to.equal(result.cell_ids.length)
    })

    it("should respect hop capacity limit", () =>
    {
        const buses: CellularBus[] = [
            { id: "Bus1", cell_id: "d4" },
        ]
        // Only 1 hop allowed
        const config: DistributionGridConfig = {
            hop_capacity_MW: [300],
        }

        const result = build_distribution_grid(buses, neighbour_cell_ids, config)

        expect(result.cell_ids).deep.equal(["c4", "d3", "d5", "e4"], "Only cells 1 hop away should be included")
        // Should not include cells 2 hops away
        expect(result.cell_ids).to.not.include("b4")
        expect(result.cell_ids).to.not.include("f4")
    })

    it("should create DC links with correct capacities by hop distance", () =>
    {
        const buses: CellularBus[] = [
            { id: "Bus1", cell_id: "d4" },
        ]
        const config: DistributionGridConfig = {
            hop_capacity_MW: [300, 50],
        }

        const result = build_distribution_grid(buses, neighbour_cell_ids, config)

        // Find links from 1-hop cells (should have 300 MW capacity)
        const first_hop_cells = new Set(["c4", "e4", "d3", "d5"])
        for (const link of result.dc_links)
        {
            if (first_hop_cells.has(link.to_bus_id) || link.to_bus_id === "Bus1")
            {
                expect(link.capacity_mw).to.equal(300)
            }
        }
    })

    it("should handle multiple buses and deterministically choose nearest one", () =>
    {
        const buses: CellularBus[] = [
            { id: "Bus1", cell_id: "d4" },
            { id: "Bus2", cell_id: "e4" },
        ]
        const config: DistributionGridConfig = {
            hop_capacity_MW: [300],
        }

        const result = build_distribution_grid(buses, neighbour_cell_ids, config)

        // c4 is equally close to both d4 and e4, but d4 comes first alphabetically
        const c4_link = result.dc_links.find(link => link.from_bus_id === "distribution:c4")
        expect(c4_link).to.exist
        expect(c4_link!.to_bus_id).to.equal("Bus1")  // d4 parent
    })

    it("should create virtual bus ids with distribution: prefix", () =>
    {
        const buses: CellularBus[] = [
            { id: "Bus1", cell_id: "d4" },
        ]
        const config: DistributionGridConfig = {
            hop_capacity_MW: [300],
        }

        const result = build_distribution_grid(buses, neighbour_cell_ids, config)

        for (const bus of result.buses)
        {
            expect(bus.id).to.match(/^distribution:/)
        }
    })
})
