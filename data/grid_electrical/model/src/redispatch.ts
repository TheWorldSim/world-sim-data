import { simplex_max } from "./simplex.ts"
import type { SolverNetwork } from "./solver_network.ts"


/** Small penalty on total flow sum|f| that breaks ties when DC link flows are not unique. Demand always wins. */
const TIE_BREAK_WEIGHT = 1e-4


/** Sparse linear expression: variable index -> coefficient */
type LinearExpression = Map<number, number>

/** expression <= limit */
interface Constraint
{
    expression: LinearExpression
    limit: number
}

interface VariableLayout
{
    line_count: number
    uses_tie_break: boolean
    total: number
    /** Dispatched generation, or served demand, of the k-th active bus */
    dispatch: (k: number) => number
    /** Flow s = forward - reverse on the m-th DC line, both >= 0 so either direction is possible */
    dc_forward: (m: number) => number
    dc_reverse: (m: number) => number
    /** t >= |f| for line l */
    abs_flow: (line: number) => number
}

export interface RedispatchResult
{
    generation_MW: number[]
    demand_MW: number[]
    /** Flow on each DC line (0 for AC lines) */
    dc_flows_MW: number[]
}


/**
 * Serves as much demand as the lines allow.
 *
 * Each active bus gets one variable in [0, |p|]: dispatched generation for a source, served demand
 * for a sink.  Each DC line gets two variables forward, reverse >= 0 with flow = forward - reverse.
 * AC flows follow from the effective injections (bus injection minus what the DC lines take out),
 * which must balance inside every AC area and keep every line within its capacity.
 */
export function redispatch(network: SolverNetwork, power_transfer: number[][], generation_MW: number[], demand_MW: number[]): RedispatchResult
{
    const result: RedispatchResult = {
        generation_MW: new Array<number>(generation_MW.length).fill(0),
        demand_MW: new Array<number>(generation_MW.length).fill(0),
        dc_flows_MW: new Array<number>(network.lines.length).fill(0),
    }

    const active_buses = generation_MW.map((_, bus) => bus).filter(bus => generation_MW[bus] > 0 || demand_MW[bus] > 0)
    if (active_buses.length === 0) return result

    const is_source = active_buses.map(bus => generation_MW[bus] > 0)
    const upper_bounds = active_buses.map((bus, k) => is_source[k] ? generation_MW[bus] : demand_MW[bus])
    const layout = create_variable_layout(active_buses.length, network.dc_line_indices.length, network.lines.length)

    const injections = build_effective_injections(network, active_buses, is_source, layout)
    const constraints = [
        ...build_bound_constraints(upper_bounds, layout),
        ...build_line_limit_constraints(network, power_transfer, injections, layout),
        ...build_area_balance_constraints(network, injections),
    ]
    const objective = build_objective(is_source, layout)

    const solution = simplex_max(
        objective,
        constraints.map(constraint => to_dense_row(constraint.expression, layout.total)),
        constraints.map(constraint => constraint.limit),
    )

    active_buses.forEach((bus, k) =>
    {
        if (is_source[k]) result.generation_MW[bus] = solution[layout.dispatch(k)]
        else result.demand_MW[bus] = solution[layout.dispatch(k)]
    })
    network.dc_line_indices.forEach((line, m) =>
    {
        result.dc_flows_MW[line] = solution[layout.dc_forward(m)] - solution[layout.dc_reverse(m)]
    })

    return result
}


function create_variable_layout(active_count: number, dc_count: number, line_count: number): VariableLayout
{
    const uses_tie_break = dc_count > 0

    return {
        line_count,
        uses_tie_break,
        total: active_count + 2 * dc_count + (uses_tie_break ? line_count : 0),
        dispatch: k => k,
        dc_forward: m => active_count + m,
        dc_reverse: m => active_count + dc_count + m,
        abs_flow: line => active_count + 2 * dc_count + line,
    }
}


function add_term(expression: LinearExpression, variable: number, coefficient: number): void
{
    expression.set(variable, (expression.get(variable) ?? 0) + coefficient)
}


function to_dense_row(expression: LinearExpression, length: number): number[]
{
    const row = new Array<number>(length).fill(0)
    expression.forEach((coefficient, variable) => { row[variable] = coefficient })
    return row
}


function negate(expression: LinearExpression): LinearExpression
{
    return new Map(Array.from(expression, ([variable, coefficient]) => [variable, -coefficient]))
}


/** Effective injection at each bus: its own generation or demand, minus what the DC lines take out */
function build_effective_injections(network: SolverNetwork, active_buses: number[], is_source: boolean[], layout: VariableLayout): LinearExpression[]
{
    const injections: LinearExpression[] = network.bus_ids.map(() => new Map())

    active_buses.forEach((bus, k) => add_term(injections[bus], layout.dispatch(k), is_source[k] ? 1 : -1))

    network.dc_line_indices.forEach((line, m) =>
    {
        const { from_bus, to_bus } = network.lines[line]
        add_term(injections[from_bus], layout.dc_forward(m), -1)
        add_term(injections[from_bus], layout.dc_reverse(m), 1)
        add_term(injections[to_bus], layout.dc_forward(m), 1)
        add_term(injections[to_bus], layout.dc_reverse(m), -1)
    })

    return injections
}


function build_flow_expression(network: SolverNetwork, power_transfer: number[][], injections: LinearExpression[], layout: VariableLayout, line: number): LinearExpression
{
    const flow: LinearExpression = new Map()

    if (network.lines[line].is_dc)
    {
        const m = network.dc_line_indices.indexOf(line)
        add_term(flow, layout.dc_forward(m), 1)
        add_term(flow, layout.dc_reverse(m), -1)
        return flow
    }

    power_transfer[line].forEach((h, bus) =>
    {
        if (h === 0) return
        injections[bus].forEach((coefficient, variable) => add_term(flow, variable, h * coefficient))
    })
    return flow
}


function build_bound_constraints(upper_bounds: number[], layout: VariableLayout): Constraint[]
{
    return upper_bounds.map((limit, k) => ({ expression: new Map([[layout.dispatch(k), 1]]), limit }))
}


/** -capacity <= flow <= capacity, plus (when tie breaking) |flow| <= t */
function build_line_limit_constraints(network: SolverNetwork, power_transfer: number[][], injections: LinearExpression[], layout: VariableLayout): Constraint[]
{
    const constraints: Constraint[] = []

    network.lines.forEach((line, l) =>
    {
        const has_limit = Number.isFinite(line.capacity_MW)
        if (!has_limit && !layout.uses_tie_break) return

        const flow = build_flow_expression(network, power_transfer, injections, layout, l)
        if (has_limit)
        {
            constraints.push({ expression: flow, limit: line.capacity_MW })
            constraints.push({ expression: negate(flow), limit: line.capacity_MW })
        }
        if (layout.uses_tie_break)
        {
            const upper = new Map(flow).set(layout.abs_flow(l), -1)
            const lower = negate(flow).set(layout.abs_flow(l), -1)
            constraints.push({ expression: upper, limit: 0 }, { expression: lower, limit: 0 })
        }
    })

    return constraints
}


/** The effective injections within each AC area must sum to zero (expressed as <= 0 and >= 0) */
function build_area_balance_constraints(network: SolverNetwork, injections: LinearExpression[]): Constraint[]
{
    const constraints: Constraint[] = []

    network.reference_buses.forEach((_, area) =>
    {
        const total: LinearExpression = new Map()
        network.bus_ids.forEach((_, bus) =>
        {
            if (network.component_of_bus[bus] !== area) return
            injections[bus].forEach((coefficient, variable) => add_term(total, variable, coefficient))
        })
        constraints.push({ expression: total, limit: 0 }, { expression: negate(total), limit: 0 })
    })

    return constraints
}


/** Maximise served demand */
function build_objective(is_source: boolean[], layout: VariableLayout): number[]
{
    const objective = new Array<number>(layout.total).fill(0)

    is_source.forEach((source, k) => { if (!source) objective[layout.dispatch(k)] = 1 })
    if (layout.uses_tie_break)
    {
        for (let l = 0; l < layout.line_count; l++) objective[layout.abs_flow(l)] = -TIE_BREAK_WEIGHT
    }

    return objective
}
