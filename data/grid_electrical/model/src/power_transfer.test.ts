import { expect } from "chai"

import { create_test_grid } from "./create_test_grid.ts"
import { build_power_transfer_matrix, calculate_ac_flows } from "./power_transfer.ts"
import { build_solver_network } from "./solver_network.ts"


function expect_close_to_all(actual: number[], expected: number[])
{
    expect(actual).to.have.length(expected.length)
    expected.forEach((value, i) => expect(actual[i], `index ${i}`).to.be.closeTo(value, 1e-9))
}


describe("build_power_transfer_matrix", () =>
{
    it("sends all flow down the single line of a two bus network", () =>
    {
        const network = build_solver_network(create_test_grid([["0", "1", 1]], [], 2))
        const power_transfer = build_power_transfer_matrix(network)

        // 1 MW injected at bus 1 and taken from reference bus 0 flows against the line direction
        expect_close_to_all(calculate_ac_flows(power_transfer, [-1, 1]), [-1])
    })


    it("splits flow around a triangle inversely to reactance (KVL)", () =>
    {
        const network = build_solver_network(create_test_grid([["0", "1", 1], ["1", "2", 1], ["0", "2", 1]]))
        const power_transfer = build_power_transfer_matrix(network)

        // 1 -> 0 directly (2/3) and via bus 2 (1/3)
        expect_close_to_all(calculate_ac_flows(power_transfer, [-1, 1, 0]), [-2 / 3, 1 / 3, -1 / 3])
    })


    it("splits flow equally between two routes of equal total reactance", () =>
    {
        const network = build_solver_network(create_test_grid([["0", "1", 2], ["1", "2", 1], ["0", "2", 1]]))
        const power_transfer = build_power_transfer_matrix(network)

        expect_close_to_all(calculate_ac_flows(power_transfer, [-1, 1, 0]), [-0.5, 0.5, -0.5])
    })


    it("satisfies KCL: flows out of each bus equal its injection", () =>
    {
        const network = build_solver_network(create_test_grid([["0", "1", 1], ["1", "2", 3], ["0", "2", 2]]))
        const power_transfer = build_power_transfer_matrix(network)
        const injections = [-5, 2, 3]
        const flows = calculate_ac_flows(power_transfer, injections)

        network.incidence.forEach((row, bus) =>
        {
            const net_outflow = row.reduce((sum, k, l) => sum + k * flows[l], 0)
            expect(net_outflow, `bus ${bus}`).to.be.closeTo(injections[bus], 1e-9)
        })
    })


    it("gives DC links zero AC flow", () =>
    {
        const network = build_solver_network(create_test_grid([["0", "1", 1]], [["1", "2"]]))
        const power_transfer = build_power_transfer_matrix(network)

        expect(power_transfer[1]).to.deep.equal([0, 0, 0])
    })
})
