import { aggregate_grid_to_cells } from "./aggregate_grid_to_cells.ts"
import type { ElectricalGrid, LatLonToCell } from "./interface.ts"
import { build_solver_network } from "./solver_network.ts"
import { solve_network } from "./solve_network.ts"


const MW_PER_GW = 1000


export interface CalculatePowerBalanceArgs
{
    electrical_grid: ElectricalGrid
    electrical_demand_GW_by_cell: {[cell_id: string]: number}
    electrical_supply_GW_by_cell: {[cell_id: string]: number}

    latlon_to_cell: LatLonToCell
}
/** Net power a cell exports to (+) or imports from (-) the grid, in GW */
export interface PowerBalanceByCell
{
    [cell_id: string]: number
}


/**
 * Aggregates the grid to cells, then dispatches supply to meet demand within the limits of the lines
 * (KCL + KVL for AC lines, controllable DC links), serving as much demand as possible.
 *
 * Supply and demand within a cell are netted first.  A cell that has supply or demand but no bus on
 * the grid cannot trade with other cells so its balance is 0.
 */
export function calculate_power_balance_by_cell(args: CalculatePowerBalanceArgs): PowerBalanceByCell
{
    const { electrical_demand_GW_by_cell, electrical_supply_GW_by_cell, latlon_to_cell } = args

    const grid = aggregate_grid_to_cells(args.electrical_grid, latlon_to_cell)
    const cell_id_by_bus = grid.busses.map(bus => latlon_to_cell.to_cell_id(bus.latlon))

    const balance_GW_by_cell: PowerBalanceByCell = {}
    const cell_ids = [...Object.keys(electrical_supply_GW_by_cell), ...Object.keys(electrical_demand_GW_by_cell), ...cell_id_by_bus]
    cell_ids.forEach(cell_id => { balance_GW_by_cell[cell_id] = 0 })

    if (grid.busses.length === 0) return balance_GW_by_cell

    const injections_MW = cell_id_by_bus.map(cell_id =>
        ((electrical_supply_GW_by_cell[cell_id] ?? 0) - (electrical_demand_GW_by_cell[cell_id] ?? 0)) * MW_PER_GW)

    const solution = solve_network(build_solver_network(grid), injections_MW)

    cell_id_by_bus.forEach((cell_id, bus) =>
    {
        balance_GW_by_cell[cell_id] = (solution.generation_MW[bus] - solution.demand_MW[bus]) / MW_PER_GW
    })

    return balance_GW_by_cell
}
