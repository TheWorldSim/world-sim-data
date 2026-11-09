import { expect } from "chai"

import { create_test_grid } from "./create_test_grid.ts"
import { solve_network } from "./solve_network.ts"
import { build_solver_network } from "./solver_network.ts"


function expect_close_to_all(actual: number[], expected: number[])
{
    expect(actual).to.have.length(expected.length)
    expected.forEach((value, i) => expect(actual[i], `index ${i}`).to.be.closeTo(value, 1e-6))
}


describe("solve_network", () =>
{
    it("serves all demand directly when lines have enough capacity", () =>
    {
        const network = build_solver_network(create_test_grid([["0", "1", 1, 1000]], [], 2))
        const solution = solve_network(network, [-500, 500])

        expect_close_to_all(solution.generation_MW, [0, 500])
        expect_close_to_all(solution.demand_MW, [500, 0])
        expect_close_to_all(solution.flows_MW, [-500])
    })


    it("scales the larger side down when supply and demand do not match", () =>
    {
        const network = build_solver_network(create_test_grid([["0", "1", 1, 1000]], [], 2))
        const solution = solve_network(network, [-300, 500])

        expect_close_to_all(solution.generation_MW, [0, 300])
        expect_close_to_all(solution.demand_MW, [300, 0])
    })


    it("limits delivery to the line capacity", () =>
    {
        const network = build_solver_network(create_test_grid([["0", "1", 1, 1000]], [], 2))
        const solution = solve_network(network, [-2000, 2000])

        expect_close_to_all(solution.generation_MW, [0, 1000])
        expect_close_to_all(solution.demand_MW, [1000, 0])
        expect_close_to_all(solution.flows_MW, [-1000])
    })


    it("splits flow around a loop inversely to reactance (KVL)", () =>
    {
        const network = build_solver_network(create_test_grid([["0", "1", 1], ["1", "2", 1], ["0", "2", 1]]))
        const solution = solve_network(network, [-900, 900, 0])

        // Directly 1 -> 0 carries 2/3, via bus 2 carries 1/3
        expect_close_to_all(solution.flows_MW, [-600, 300, -300])
    })


    it("splits flow equally between two routes of equal total reactance", () =>
    {
        const network = build_solver_network(create_test_grid([["0", "1", 2], ["1", "2", 1], ["0", "2", 1]]))
        const solution = solve_network(network, [-100, 100, 0])

        expect_close_to_all(solution.flows_MW, [-50, 50, -50])
    })


    it("satisfies KCL: net flow out of each bus equals the dispatch at that bus", () =>
    {
        const lines: [string, string, number][] = [["0", "1", 1], ["1", "2", 3], ["0", "2", 2]]
        const network = build_solver_network(create_test_grid(lines))
        const solution = solve_network(network, [-50, 20, 30])

        network.bus_ids.forEach((_, bus_index) =>
        {
            const net_outflow = network.lines.reduce((sum, line, l) =>
                sum + (line.from_bus_index === bus_index ? solution.flows_MW[l] : 0) - (line.to_bus_index === bus_index ? solution.flows_MW[l] : 0), 0)

            expect(net_outflow, `bus_index ${bus_index}`).to.be.closeTo(solution.generation_MW[bus_index] - solution.demand_MW[bus_index], 1e-6)
        })
    })


    it("is limited by the most loaded line of a loop, as flow splits by reactance", () =>
    {
        // 2/3 of the flow takes the direct line 0-1, so its 400 MW limit allows only 600 MW through
        const network = build_solver_network(create_test_grid([["0", "1", 1, 400], ["1", "2", 1], ["0", "2", 1]]))
        const solution = solve_network(network, [-1000, 1000, 0])

        expect_close_to_all(solution.demand_MW, [600, 0, 0])
        expect_close_to_all(solution.flows_MW, [-400, 200, -200])
    })


    it("limits delivery to the capacity of a DC link", () =>
    {
        const network = build_solver_network(create_test_grid([], [["0", "1", 300]], 2))
        const solution = solve_network(network, [-500, 500])

        expect_close_to_all(solution.demand_MW, [300, 0])
        expect_close_to_all(solution.flows_MW, [-300])
    })


    it("lets a DC link carry power between separate AC areas", () =>
    {
        const network = build_solver_network(create_test_grid([["0", "1", 1], ["2", "3", 1]], [["1", "2"]], 4))
        const solution = solve_network(network, [-100, 0, 0, 100])

        expect_close_to_all(solution.demand_MW, [100, 0, 0, 0])
        expect_close_to_all(solution.generation_MW, [0, 0, 0, 100])
    })


    it("does not move power between AC areas that are not connected", () =>
    {
        const network = build_solver_network(create_test_grid([["0", "1", 1], ["2", "3", 1]], [], 4))
        const solution = solve_network(network, [-100, 100, -50, 0])

        expect_close_to_all(solution.demand_MW, [100, 0, 0, 0])
        expect_close_to_all(solution.generation_MW, [0, 100, 0, 0])
    })


    it("does nothing for a network with no supply or demand", () =>
    {
        const network = build_solver_network(create_test_grid([["0", "1", 1]], [], 2))
        const solution = solve_network(network, [0, 0])

        expect(solution.generation_MW).to.deep.equal([0, 0])
        expect(solution.demand_MW).to.deep.equal([0, 0])
    })
})
