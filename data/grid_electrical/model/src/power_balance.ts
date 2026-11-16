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
 *   idle                        no supply and no demand
 *   supplying                   all net supply is dispatched
 *   supply_curtailed_by_demand  some net supply is not dispatched, and no demand anywhere is left unmet
 *   supply_curtailed_by_grid    some net supply is not dispatched while demand is left unmet, or the cell has no bus
 *   demand_met                  all net demand is served, including demand exactly matched by the cell's own supply (but only when there is some demand and supply otherwise the status will be "idle")
 *   demand_unmet_by_supply      some net demand is not served as its connected grid has less supply than demand
 *   demand_unmet_by_grid        some net demand is not served due to lack of transmission grid, with enough supply in its connected grid
 */
export type CellStatus = (
    "idle" |
    "supplying" |
    "supply_curtailed_by_demand" |
    "supply_curtailed_by_grid" |
    "demand_met" |
    "demand_unmet_by_supply" |
    "demand_unmet_by_grid"
)

const NEGLIGIBLE_MW = 1e-6


/**
 * Aggregates the grid to cells, then dispatches supply to meet demand within the limits of the lines
 * (KCL + KVL for AC lines, controllable DC links), serving as much demand as possible.
 *
 * Supply and demand within a cell are netted first.  A cell that has supply or demand but no bus on
 * the grid cannot trade with other cells so its balance is 0, unless distribution config on the
 * cellular grid connects it to its nearest bus.
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

    const distribution = grid.distribution_grid
    const solver_node_cell_ids = [...bus_cell_ids, ...distribution.buses.map(bus => bus.cell_id)]
    const solver_network = build_solver_network({
        buses: [...grid.buses, ...distribution.buses],
        ac_lines: grid.ac_lines,
        dc_links: [...grid.dc_links, ...distribution.dc_links],
    })

    let total_net_MW = 0
    const injections_MW = solver_node_cell_ids.map(cell_id =>
    {
        const value = (supply_MW_by_cell_id[cell_id] ?? 0) - (demand_MW_by_cell_id[cell_id] ?? 0)
        total_net_MW += value
        return value
    })



    const solution = solve_network(solver_network, injections_MW)

    solver_node_cell_ids.forEach((cell_id, node_index) =>
    {
        // Cells on the distribution grid without supply or demand are only carrying flow, so have no entry
        if (cell_id in power_balance.MW_by_cell_id) power_balance.MW_by_cell_id[cell_id] = (solution.generation_MW[node_index]! - solution.demand_MW[node_index]!)
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

    power_balance.status_by_cell_id = calculate_status_by_cell(powered_grid, power_balance.MW_by_cell_id, total_net_MW)

    return power_balance
}



function calculate_status_by_cell(powered_grid: PoweredCellularElectricalGrid, MW_by_cell: PowerBalance["MW_by_cell_id"], total_net_MW: number): PowerBalance["status_by_cell_id"]
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
            if ((-requested_MW + actual_MW <= NEGLIGIBLE_MW))
            {
                status_by_cell[cell_id] = "demand_met"
            }
            else if (!cells_with_bus.has(cell_id)) status_by_cell[cell_id] = "demand_unmet_by_grid"
            else
            {
                status_by_cell[cell_id] = total_net_MW >= 0 ? "demand_unmet_by_grid" : "demand_unmet_by_supply"
            }
        }
        else if ((demand_MW_by_cell[cell_id] ?? 0) > NEGLIGIBLE_MW) status_by_cell[cell_id] = "demand_met"  // demand exactly matched by supply
        else status_by_cell[cell_id] = "idle"
    }

    return status_by_cell
}
