import { expect } from "chai"

import {
    build_fundamental_cycles,
    build_incidence_matrix,
    find_ac_spanning_forest,
    type LineEnds,
} from "./network_matrices.ts"


const triangle: LineEnds[] = [
    { from_bus: 0, to_bus: 1, is_dc: false },
    { from_bus: 1, to_bus: 2, is_dc: false },
    { from_bus: 0, to_bus: 2, is_dc: false },
]


describe("build_incidence_matrix", () =>
{
    it("is +1 where a line starts and -1 where it ends", () =>
    {
        expect(build_incidence_matrix(3, triangle)).to.deep.equal([
            [1, 0, 1],
            [-1, 1, 0],
            [0, -1, -1],
        ])
    })
})


describe("find_ac_spanning_forest", () =>
{
    it("finds one tree for a connected AC network", () =>
    {
        const forest = find_ac_spanning_forest(3, triangle)

        expect(forest.reference_buses).to.deep.equal([0])
        expect(forest.component_of_bus).to.deep.equal([0, 0, 0])
        expect(forest.tree_lines.size).to.equal(2)
    })


    it("finds a separate tree for each AC area, not joining areas across a DC line", () =>
    {
        const forest = find_ac_spanning_forest(3, [
            { from_bus: 0, to_bus: 1, is_dc: false },
            { from_bus: 1, to_bus: 2, is_dc: true },
        ])

        expect(forest.reference_buses).to.deep.equal([0, 2])
        expect(forest.component_of_bus).to.deep.equal([0, 0, 1])
    })
})


describe("build_fundamental_cycles", () =>
{
    it("finds the one cycle of a triangle, signed by direction of travel", () =>
    {
        const forest = find_ac_spanning_forest(3, triangle)

        // 1 -> 2 along line 1, 2 -> 0 against line 2, 0 -> 1 along line 0
        expect(build_fundamental_cycles(triangle, forest)).to.deep.equal([[1, 1, -1]])
    })


    it("finds no cycles in a tree", () =>
    {
        const lines = triangle.slice(0, 2)
        expect(build_fundamental_cycles(lines, find_ac_spanning_forest(3, lines))).to.deep.equal([])
    })


    it("finds a cycle for each parallel line", () =>
    {
        const lines: LineEnds[] = [
            { from_bus: 0, to_bus: 1, is_dc: false },
            { from_bus: 0, to_bus: 1, is_dc: false },
        ]

        expect(build_fundamental_cycles(lines, find_ac_spanning_forest(2, lines))).to.deep.equal([[-1, 1]])
    })


    it("ignores DC lines", () =>
    {
        const lines: LineEnds[] = [
            { from_bus: 0, to_bus: 1, is_dc: false },
            { from_bus: 0, to_bus: 1, is_dc: true },
        ]

        expect(build_fundamental_cycles(lines, find_ac_spanning_forest(2, lines))).to.deep.equal([])
    })
})
