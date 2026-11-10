import {
    maximise,
    type LinearProgram,
    type LpConstraint,
    type LpTerm,
    type LpVariable,
} from "./lp_solver.ts"
import type { SolverNetwork } from "./solver_network.ts"
import { safe_index__number, safe_index__array, safe_index } from "./utils.ts"


const NEGLIGIBLE_MW = 1e-6

/** Small penalty on total flow sum|f| that breaks ties when DC link flows are not unique. Demand always wins. */
const TIE_BREAK_WEIGHT = 1e-4


export interface NetworkSolution
{
    /** Dispatched generation at each bus */
    generation_MW: number[]
    /** Served demand at each bus */
    demand_MW: number[]
    /** Flow on each line, positive from the line's start bus to its end bus */
    flows_MW: number[]
}


/**
 * Dispatches generation and serves demand across the network, serving as much demand as the lines allow.
 * injections_MW: + source, - sink, one per bus.
 *
 * With a single AC area and no DC links, first tries to deliver the request scaled down so supply meets
 * demand (spreading any shortfall or surplus proportionally).  If the lines cannot carry that, or when
 * there are several areas or DC links, serves as much demand as possible however it can be done.
 */
export function solve_network(network: SolverNetwork, injections_MW: number[]): NetworkSolution
{
    const generation = injections_MW.map(p => Math.max(p, 0))
    const demand = injections_MW.map(p => Math.max(-p, 0))

    // const has_dc_lines = network.lines.some(line => line.is_dc)
    // if (network.ac_area_count === 1 && !has_dc_lines)
    // {
    //     const balanced_request = scale_to_balance(generation, demand)
    //     const solution = dispatch(network, balanced_request.generation, balanced_request.demand)

    //     if (sum(solution.demand_MW) >= sum(balanced_request.demand) - NEGLIGIBLE_MW) return solution
    // }

    return dispatch(network, generation, demand)
}


// function scale_to_balance(generation: number[], demand: number[]): { generation: number[], demand: number[] }
// {
//     const total_generation = sum(generation)
//     const total_demand = sum(demand)
//     const served = Math.min(total_generation, total_demand)

//     return {
//         generation: generation.map(g => total_generation > 0 ? g * served / total_generation : 0),
//         demand: demand.map(d => total_demand > 0 ? d * served / total_demand : 0),
//     }
// }


/**
 * One linear program over the whole network:
 *   variables    dispatch (generation or served demand) at each active bus, a flow on every line,
 *                and when there are DC links an |flow| helper per line
 *   KCL          at every bus, net flow out of the bus equals its injection
 *   KVL          around every AC cycle, reactance weighted flow sums to zero
 *   limits       each flow within the line's capacity, each dispatch within what was requested
 *   objective    maximise served demand
 */
function dispatch(network: SolverNetwork, generation: number[], demand: number[]): NetworkSolution
{
    const bus_count = network.bus_ids.length
    const result: NetworkSolution = {
        generation_MW: new Array<number>(bus_count).fill(0),
        demand_MW: new Array<number>(bus_count).fill(0),
        flows_MW: new Array<number>(network.lines_and_links.length).fill(0),
    }

    if (generation.length !== network.bus_ids.length) throw new Error(`Generation array length ${generation.length} mismatch with network bus count ${network.bus_ids.length}`)
    if (demand.length !== network.bus_ids.length) throw new Error(`Demand array length ${demand.length} mismatch with network bus count ${network.bus_ids.length}`)

    const active_bus_indexs = network.bus_ids
        .map((_, bus_index) => bus_index)
        .filter(bus_index => safe_index__number(generation, bus_index) > 0 || safe_index__number(demand, bus_index) > 0)
    if (active_bus_indexs.length === 0) return result

    const layout = create_variable_layout(active_bus_indexs.length, network.lines_and_links.length, network.lines_and_links.some(line => line.is_dc))
    const is_source = active_bus_indexs.map(bus_index => safe_index__number(generation, bus_index) > 0)

    const program: LinearProgram = {
        variables: [
            ...build_dispatch_variables(active_bus_indexs, is_source, generation, demand),
            ...build_flow_variables(network),
            ...build_abs_flow_variables(network, layout),
        ],
        constraints: [
            ...build_kcl_constraints(network, active_bus_indexs, is_source, layout),
            ...build_kvl_constraints(network, layout),
            ...build_abs_flow_constraints(network, layout),
        ],
    }
    const solution = maximise(program)

    active_bus_indexs.forEach((bus_index, k) =>
    {
        if (is_source[k]) result.generation_MW[bus_index] = clean(safe_index__number(solution, k))
        else result.demand_MW[bus_index] = clean(safe_index__number(solution, k))
    })
    network.lines_and_links.forEach((_, l) => { result.flows_MW[l] = clean(safe_index__number(solution, layout.flow(l))) })

    return result
}


interface VariableLayout
{
    uses_abs_flow: boolean
    // /** Dispatched generation, or served demand, of the k-th active bus */
    // dispatch: (k: number) => number
    flow: (line: number) => number
    /** t >= |flow| for a line, only present when there are DC links */
    abs_flow: (line: number) => number
}


function create_variable_layout(active_count: number, line_count: number, uses_abs_flow: boolean): VariableLayout
{
    return {
        uses_abs_flow,
        // dispatch: k => k,
        flow: line => active_count + line,
        abs_flow: line => active_count + line_count + line,
    }
}


function build_dispatch_variables(active_bus_indexs: number[], is_source: boolean[], generation: number[], demand: number[]): LpVariable[]
{
    return active_bus_indexs.map((bus_index, k) => is_source[k]
        ? { lower: 0, upper: safe_index__number(generation, bus_index), objective: 0 }
        : { lower: 0, upper: safe_index__number(demand, bus_index), objective: 1 })
}


function build_flow_variables(network: SolverNetwork): LpVariable[]
{
    return network.lines_and_links.map(line => ({ lower: -line.capacity_MW, upper: line.capacity_MW, objective: 0 }))
}


function build_abs_flow_variables(network: SolverNetwork, layout: VariableLayout): LpVariable[]
{
    if (!layout.uses_abs_flow) return []
    return network.lines_and_links.map(() => ({ lower: 0, upper: Infinity, objective: -TIE_BREAK_WEIGHT }))
}


/** Net flow out of each bus (sum of line flows leaving it minus those arriving) = its injection */
function build_kcl_constraints(network: SolverNetwork, active_bus_indexs: number[], is_source: boolean[], layout: VariableLayout): LpConstraint[]
{
    const terms_by_bus: LpTerm[][] = network.bus_ids.map(() => [])

    network.lines_and_links.forEach((line, l) =>
    {
        safe_index__array(terms_by_bus, line.from_bus_index).push([layout.flow(l), 1])
        safe_index__array(terms_by_bus, line.to_bus_index).push([layout.flow(l), -1])
    })
    // Moving the injection to the left hand side: outflow - injection = 0
    active_bus_indexs.forEach((bus_index, k) => safe_index__array(terms_by_bus, bus_index).push([k, is_source[k] ? -1 : 1]))

    return terms_by_bus.map(terms => ({ lower: 0, upper: 0, terms }))
}


/** Around each AC cycle: sum of (direction * reactance * flow) = 0 */
function build_kvl_constraints(network: SolverNetwork, layout: VariableLayout): LpConstraint[]
{
    // Only rescales the KVL rows, keeping the coefficients near the size of the KCL ones
    const reactance_scale = Math.max(...network.lines_and_links.map(line => Math.abs(line.reactance_pu)), Number.MIN_VALUE)

    return network.cycles.map(cycle => ({
        lower: 0,
        upper: 0,
        terms: cycle.map(({ line_or_link_index: line_index, direction }): LpTerm =>
            [layout.flow(line_index), direction * safe_index(network.lines_and_links, line_index).reactance_pu / reactance_scale]),
    }))
}


/** flow <= t and -flow <= t, so that t is at least |flow| */
function build_abs_flow_constraints(network: SolverNetwork, layout: VariableLayout): LpConstraint[]
{
    if (!layout.uses_abs_flow) return []

    return network.lines_and_links.flatMap((_, line_index): LpConstraint[] => [
        { lower: -Infinity, upper: 0, terms: [[layout.flow(line_index), 1], [layout.abs_flow(line_index), -1]] },
        { lower: -Infinity, upper: 0, terms: [[layout.flow(line_index), -1], [layout.abs_flow(line_index), -1]] },
    ])
}


// function sum(values: number[]): number
// {
//     return values.reduce((total, value) => total + value, 0)
// }


function clean(value: number): number
{
    return Math.abs(value) < NEGLIGIBLE_MW ? 0 : value
}
