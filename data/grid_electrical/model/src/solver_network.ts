import type { CommonElectricalGrid } from "./interface.ts"
import {
    build_fundamental_cycles,
    find_ac_spanning_forest,
    type CycleStep,
    type Edge,
} from "./network_cycles.ts"


export interface SolverLineOrLink extends Edge
{
    /** Zero for DC links, which are controllable rather than governed by KVL */
    reactance_pu: number
    capacity_MW: number
}


/** The grid as indices, ready for the power flow solver */
export interface SolverNetwork
{
    bus_ids: string[]
    lines_and_links: SolverLineOrLink[]
    /** KVL cycles of the AC lines only (a DC link breaks KVL) */
    cycles: CycleStep[][]
    // /** Number of separate synchronous (AC connected) areas, each of which must balance on its own */
    // ac_area_count: number
}


/**
 * AC lines with a non-finite reactance are open circuits and are dropped.
 * Expects every line to join two different known buses (as produced by aggregate_grid_to_cells).
 */
export function build_solver_network(grid: CommonElectricalGrid): SolverNetwork
{
    const bus_ids = grid.buses.map(bus => bus.id)
    const bus_index_by_id = new Map(bus_ids.map((id, i) => [id, i]))

    const lines_and_links: SolverLineOrLink[] = [
        ...grid.ac_lines
            .filter(line => Number.isFinite(line.x_pu))
            .map(line => create_solver_line(line.from_bus_id, line.to_bus_id, false, line.x_pu, line.capacity_mw, bus_index_by_id)),
        ...grid.dc_links
            .map(link => create_solver_line(link.from_bus_id, link.to_bus_id, true, 0, link.capacity_mw, bus_index_by_id)),
    ]

    const forest = find_ac_spanning_forest(bus_ids.length, lines_and_links)

    return {
        bus_ids,
        lines_and_links,
        cycles: build_fundamental_cycles(lines_and_links, forest),
        // ac_area_count: forest.reference_buses.length,
    }
}


function create_solver_line(from_bus_id: string, to_bus_id: string, is_dc: boolean, reactance_pu: number, capacity_MW: number, bus_index_by_id: Map<string, number>): SolverLineOrLink
{
    const from_bus_index = get_bus_index(from_bus_id, bus_index_by_id)
    const to_bus_index = get_bus_index(to_bus_id, bus_index_by_id)
    if (from_bus_index === to_bus_index) throw new Error(`Line connects bus ${from_bus_id} to itself`)

    return { from_bus_index, to_bus_index, is_dc, reactance_pu, capacity_MW }
}


function get_bus_index(bus_id: string, bus_index_by_id: Map<string, number>): number
{
    const index = bus_index_by_id.get(bus_id)
    if (index === undefined) throw new Error(`Line uses bus "${bus_id}" which is not in the grid`)
    return index
}
