import type { CellularElectricalGrid, LatLonElectricalGrid } from "./interface.ts"
import { solve_network } from "./solve_network.ts"
import { build_solver_network } from "./solver_network.ts"


/** Lat/lon grid with supply and demand keyed by bus, so it can be reaggregated to any DGG */
export interface PoweredLatLonElectricalGrid
{
    latlon_grid: LatLonElectricalGrid
    demand_MW_by_bus_id: {[bus_id: string]: number}
    supply_MW_by_bus_id: {[bus_id: string]: number}
}
export interface PoweredCellularElectricalGrid
{
    cellular_grid: CellularElectricalGrid
    demand_MW_by_cell_id: {[cell_id: string]: number}
    supply_MW_by_cell_id: {[cell_id: string]: number}
}
/** Net power a cell exports to (+) or imports from (-) the grid, in GW; flows on lines and links in MW */
export interface PowerBalance
{
    MW_by_cell_id: {[cell_id: string]: number}
    MW_by_line_id: {[line_id: string]: number}
    MW_by_link_id: {[link_id: string]: number}
    status_by_cell_id: {[cell_id: string]: CellStatus}
}
/**
 * How well a cell's net supply or demand was met:
 *   idle                        no net supply or demand
 *   supplying                   all net supply is dispatched
 *   supply_curtailed_by_demand  some net supply is not dispatched, and no demand anywhere is left unmet
 *   supply_curtailed_by_grid    some net supply is not dispatched while demand is left unmet, or the cell has no bus
 *   demand_met                  all net demand is served
 *   demand_unmet                some net demand is not served
 */
export type CellStatus = "idle" | "supplying" | "supply_curtailed_by_demand" | "supply_curtailed_by_grid" | "demand_met" | "demand_unmet"

const NEGLIGIBLE_MW = 1e-6


/**
 * Aggregates the grid to cells, then dispatches supply to meet demand within the limits of the lines
 * (KCL + KVL for AC lines, controllable DC links), serving as much demand as possible.
 *
 * Supply and demand within a cell are netted first.  A cell that has supply or demand but no bus on
 * the grid cannot trade with other cells so its balance is 0.
 */
export function calculate_power_balance(powered_grid: PoweredCellularElectricalGrid): PowerBalance
{
    const { cellular_grid: grid, demand_MW_by_cell_id, supply_MW_by_cell_id } = powered_grid

    const bus_cell_ids = grid.buses.map(bus => bus.cell_id)

    const power_balance: PowerBalance = {
        MW_by_cell_id: {},
        MW_by_line_id: {},
        MW_by_link_id: {},
        status_by_cell_id: {},
    }

    ;[
        ...Object.keys(supply_MW_by_cell_id),
        ...Object.keys(demand_MW_by_cell_id),
        ...bus_cell_ids,
    ].forEach(cell_id => power_balance.MW_by_cell_id[cell_id] = 0)

    if (grid.buses.length === 0)
    {
        power_balance.status_by_cell_id = calculate_status_by_cell(powered_grid, power_balance.MW_by_cell_id)
        return power_balance
    }

    const injections_MW = bus_cell_ids.map(cell_id =>
        ((supply_MW_by_cell_id[cell_id] ?? 0) - (demand_MW_by_cell_id[cell_id] ?? 0)))

    const solver_network = build_solver_network(grid)
    const solution = solve_network(solver_network, injections_MW)

    bus_cell_ids.forEach((cell_id, bus_index) =>
    {
        power_balance.MW_by_cell_id[cell_id] = (solution.generation_MW[bus_index]! - solution.demand_MW[bus_index]!)
    })

    // Record line flows
    let line_index = 0
    for (const line of grid.ac_lines)
    {
        power_balance.MW_by_line_id[line.id] = solution.flows_MW[line_index]!
        ++line_index
    }

    // Record link flows
    for (const link of grid.dc_links)
    {
        power_balance.MW_by_link_id[link.id] = solution.flows_MW[line_index]!
        ++line_index
    }

    power_balance.status_by_cell_id = calculate_status_by_cell(powered_grid, power_balance.MW_by_cell_id)

    return power_balance
}


function calculate_status_by_cell(powered_grid: PoweredCellularElectricalGrid, MW_by_cell: PowerBalance["MW_by_cell_id"]): PowerBalance["status_by_cell_id"]
{
    const { cellular_grid: grid, demand_MW_by_cell_id: demand_MW_by_cell, supply_MW_by_cell_id: supply_MW_by_cell } = powered_grid
    const cells_with_bus = new Set(grid.buses.map(bus => bus.cell_id))

    const requested_MW_by_cell_id: {[cell_id: string]: number} = {}
    let total_unmet_demand_MW = 0
    for (const [cell_id, actual_MW] of Object.entries(MW_by_cell))
    {
        const requested_MW = (supply_MW_by_cell[cell_id] ?? 0) - (demand_MW_by_cell[cell_id] ?? 0)
        requested_MW_by_cell_id[cell_id] = requested_MW
        // actual_MW is negative for served demand
        if (requested_MW < 0) total_unmet_demand_MW += Math.max(-requested_MW + actual_MW, 0)
    }

    const status_by_cell: PowerBalance["status_by_cell_id"] = {}
    for (const [cell_id, actual_MW] of Object.entries(MW_by_cell))
    {
        const requested_MW = requested_MW_by_cell_id[cell_id]!

        if (requested_MW > NEGLIGIBLE_MW)
        {
            if (requested_MW - actual_MW <= NEGLIGIBLE_MW) status_by_cell[cell_id] = "supplying"
            else if (!cells_with_bus.has(cell_id) || total_unmet_demand_MW > NEGLIGIBLE_MW) status_by_cell[cell_id] = "supply_curtailed_by_grid"
            else status_by_cell[cell_id] = "supply_curtailed_by_demand"
        }
        else if (requested_MW < -NEGLIGIBLE_MW)
        {
            status_by_cell[cell_id] = (-requested_MW + actual_MW <= NEGLIGIBLE_MW) ? "demand_met" : "demand_unmet"
        }
        else status_by_cell[cell_id] = "idle"
    }

    return status_by_cell
}
