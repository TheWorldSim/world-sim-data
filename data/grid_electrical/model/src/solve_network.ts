import { build_power_transfer_matrix, calculate_ac_flows } from "./power_transfer.ts"
import { redispatch } from "./redispatch.ts"
import type { SolverNetwork } from "./solver_network.ts"


const NEGLIGIBLE_MW = 1e-9


export type SolveMethod = "linear" | "redispatch" | "dispatch"

export interface NetworkSolution
{
    method: SolveMethod
    /** Dispatched generation at each bus */
    generation_MW: number[]
    /** Served demand at each bus */
    demand_MW: number[]
    /** Flow on each line, positive from the line's start bus to its end bus */
    flows_MW: number[]
}


/**
 * Dispatches generation and serves demand across the network.
 * injections_MW: + source, - sink, one per bus.
 *
 * With a single AC area and no DC links, scales the request so supply meets demand and solves KCL + KVL directly,
 * only falling back to a redispatch LP when a line limit is exceeded.  Otherwise (DC link flows are free decisions,
 * and separate AC areas must each balance) always solves the LP.
 */
export function solve_network(network: SolverNetwork, injections_MW: number[]): NetworkSolution
{
    const power_transfer = build_power_transfer_matrix(network)
    const generation = injections_MW.map(p => Math.max(p, 0))
    const demand = injections_MW.map(p => Math.max(-p, 0))

    const is_single_ac_area = network.dc_line_indices.length === 0 && network.reference_buses.length === 1
    const solution = is_single_ac_area
        ? solve_single_ac_area(network, power_transfer, generation, demand)
        : solve_with_redispatch(network, power_transfer, generation, demand, "dispatch")

    return {
        method: solution.method,
        generation_MW: solution.generation_MW.map(remove_negligible),
        demand_MW: solution.demand_MW.map(remove_negligible),
        flows_MW: solution.flows_MW.map(remove_negligible),
    }
}


function solve_single_ac_area(network: SolverNetwork, power_transfer: number[][], generation: number[], demand: number[]): NetworkSolution
{
    const total_generation = sum(generation)
    const total_demand = sum(demand)
    const served = Math.min(total_generation, total_demand)

    // Balance the request by scaling the larger side down proportionally
    const dispatched_generation = generation.map(g => total_generation > 0 ? g * served / total_generation : 0)
    const served_demand = demand.map(d => total_demand > 0 ? d * served / total_demand : 0)
    const flows = calculate_ac_flows(power_transfer, net_injections(dispatched_generation, served_demand))

    const is_over_limit = flows.some((flow, l) => Math.abs(flow) > network.lines[l].capacity_MW + NEGLIGIBLE_MW)
    if (is_over_limit) return solve_with_redispatch(network, power_transfer, generation, demand, "redispatch")

    return { method: "linear", generation_MW: dispatched_generation, demand_MW: served_demand, flows_MW: flows }
}


function solve_with_redispatch(network: SolverNetwork, power_transfer: number[][], generation: number[], demand: number[], method: SolveMethod): NetworkSolution
{
    const { generation_MW, demand_MW, dc_flows_MW } = redispatch(network, power_transfer, generation, demand)
    const flows = calculate_flows_with_dc(network, power_transfer, generation_MW, demand_MW, dc_flows_MW)

    return { method, generation_MW, demand_MW, flows_MW: flows }
}


/** AC flows follow from the injections left after the DC links have taken their share */
function calculate_flows_with_dc(network: SolverNetwork, power_transfer: number[][], generation: number[], demand: number[], dc_flows: number[]): number[]
{
    const injections = net_injections(generation, demand)
    network.dc_line_indices.forEach(line =>
    {
        injections[network.lines[line].from_bus] -= dc_flows[line]
        injections[network.lines[line].to_bus] += dc_flows[line]
    })

    const flows = calculate_ac_flows(power_transfer, injections)
    network.dc_line_indices.forEach(line => { flows[line] = dc_flows[line] })
    return flows
}


function net_injections(generation: number[], demand: number[]): number[]
{
    return generation.map((g, bus) => g - demand[bus])
}


function sum(values: number[]): number
{
    return values.reduce((total, value) => total + value, 0)
}


function remove_negligible(value: number): number
{
    return Math.abs(value) < NEGLIGIBLE_MW ? 0 : value
}
