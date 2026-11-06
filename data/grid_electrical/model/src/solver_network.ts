import type { ElectricalGrid } from "./interface.ts"
import {
    build_fundamental_cycles,
    build_incidence_matrix,
    find_ac_spanning_forest,
    type LineEnds,
} from "./network_matrices.ts"


export interface SolverLine extends LineEnds
{
    /** Zero for DC links, which are controllable rather than governed by KVL */
    reactance_pu: number
    /** Infinity when the line has no known limit */
    capacity_MW: number
}


/** The grid as indices and matrices, ready for the power flow solver */
export interface SolverNetwork
{
    bus_ids: string[]
    lines: SolverLine[]
    /** incidence[bus][line] is +1 where the line starts, -1 where it ends */
    incidence: number[][]
    /** KVL cycles of the AC lines only (a DC link breaks KVL) */
    cycles: number[][]
    ac_line_indices: number[]
    dc_line_indices: number[]
    /** Which synchronous (AC connected) area each bus belongs to */
    component_of_bus: number[]
    /** One reference bus per AC area */
    reference_buses: number[]
}


/**
 * AC lines with a non-finite reactance are open circuits and are dropped.
 * Expects every line to join two different known busses (as produced by aggregate_grid_to_cells).
 */
export function build_solver_network(grid: ElectricalGrid): SolverNetwork
{
    const bus_ids = grid.busses.map(bus => bus.id)
    const bus_index_by_id = new Map(bus_ids.map((id, i) => [id, i]))

    const lines: SolverLine[] = [
        ...grid.ac_lines
            .filter(line => Number.isFinite(line.x_pu))
            .map(line => create_solver_line(line.from_bus_id, line.to_bus_id, false, line.x_pu, line.capacity_mw, bus_index_by_id)),
        ...grid.dc_links
            .map(link => create_solver_line(link.from_bus_id, link.to_bus_id, true, 0, link.capacity_mw, bus_index_by_id)),
    ]

    const forest = find_ac_spanning_forest(bus_ids.length, lines)
    const line_indices = lines.map((_, l) => l)

    return {
        bus_ids,
        lines,
        incidence: build_incidence_matrix(bus_ids.length, lines),
        cycles: build_fundamental_cycles(lines, forest),
        ac_line_indices: line_indices.filter(l => !lines[l].is_dc),
        dc_line_indices: line_indices.filter(l => lines[l].is_dc),
        component_of_bus: forest.component_of_bus,
        reference_buses: forest.reference_buses,
    }
}


function create_solver_line(from_bus_id: string, to_bus_id: string, is_dc: boolean, reactance_pu: number, capacity_mw: number, bus_index_by_id: Map<string, number>): SolverLine
{
    const from_bus = get_bus_index(from_bus_id, bus_index_by_id)
    const to_bus = get_bus_index(to_bus_id, bus_index_by_id)
    if (from_bus === to_bus) throw new Error(`Line connects bus ${from_bus_id} to itself`)

    const has_limit = Number.isFinite(capacity_mw) && capacity_mw >= 0
    return { from_bus, to_bus, is_dc, reactance_pu, capacity_MW: has_limit ? capacity_mw : Infinity }
}


function get_bus_index(bus_id: string, bus_index_by_id: Map<string, number>): number
{
    const index = bus_index_by_id.get(bus_id)
    if (index === undefined) throw new Error(`Line uses bus "${bus_id}" which is not in the grid`)
    return index
}
