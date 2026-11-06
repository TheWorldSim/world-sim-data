import { lu_factor } from "./lu_factor.ts"
import type { SolverNetwork } from "./solver_network.ts"


/**
 * Builds H so that AC line flows f = H p for any bus injections p that balance within each AC area.
 *
 * Solves KCL for every bus except one reference bus per AC area (incidence . f = p), stacked on one
 * KVL row per cycle (sum of reactance * f around the cycle = 0), once for a unit injection at each bus.
 * Reference bus columns and DC line rows are zero.
 */
export function build_power_transfer_matrix(network: SolverNetwork): number[][]
{
    const bus_count = network.bus_ids.length
    const line_count = network.lines.length
    const ac_lines = network.ac_line_indices

    const power_transfer = Array.from({ length: line_count }, () => new Array<number>(bus_count).fill(0))
    if (ac_lines.length === 0) return power_transfer

    const reference_buses = new Set(network.reference_buses)
    const non_reference_buses = network.bus_ids.map((_, bus) => bus).filter(bus => !reference_buses.has(bus))

    const system = build_kcl_kvl_system(network, non_reference_buses)
    const solve = lu_factor(system)

    non_reference_buses.forEach((bus, row) =>
    {
        const unit_injection = new Float64Array(ac_lines.length)
        unit_injection[row] = 1

        const flows = solve(unit_injection)
        ac_lines.forEach((line, k) => { power_transfer[line][bus] = flows[k] })
    })

    return power_transfer
}


/** Square system over the AC lines: KCL rows for the non-reference busses, then one KVL row per cycle */
function build_kcl_kvl_system(network: SolverNetwork, non_reference_buses: number[]): number[][]
{
    const ac_lines = network.ac_line_indices

    // Only rescales the KVL rows, keeping the matrix well conditioned
    const reactance_scale = Math.max(...ac_lines.map(l => Math.abs(network.lines[l].reactance_pu)))

    const kcl_rows = non_reference_buses.map(bus => ac_lines.map(l => network.incidence[bus][l]))
    const kvl_rows = network.cycles.map(cycle => ac_lines.map(l => cycle[l] * network.lines[l].reactance_pu / reactance_scale))

    return [...kcl_rows, ...kvl_rows]
}


/** Flow on every line (DC lines get 0) for the given bus injections */
export function calculate_ac_flows(power_transfer: number[][], injections: number[]): number[]
{
    return power_transfer.map(row => row.reduce((sum, h, bus) => sum + h * injections[bus], 0))
}
