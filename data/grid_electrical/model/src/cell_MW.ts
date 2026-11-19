import type { CellularElectricalGrid } from "./interface.ts"
import type { PoweredCellularElectricalGrid } from "./power_balance.ts"


// Several buses can share a cell after aggregation, so their MW are summed
export function bus_MW_to_cell_MW(MW_by_bus: {[bus_id: string]: number}, cellular_grid: CellularElectricalGrid): {[cell_id: string]: number}
{
    const MW_by_cell: {[cell_id: string]: number} = {}
    for (const [bus_id, MW] of Object.entries(MW_by_bus))
    {
        const cell_id = cellular_grid.bus_id_to_cell_id(bus_id)
        MW_by_cell[cell_id] = (MW_by_cell[cell_id] ?? 0) + MW
    }
    return MW_by_cell
}


export function get_net_MW_by_cell(grid: Pick<PoweredCellularElectricalGrid, "supply_MW_by_cell_id" | "demand_MW_by_cell_id">): Record<string, number>
{
    return Array.from(new Set(Object.keys(grid.demand_MW_by_cell_id).concat(Object.keys(grid.supply_MW_by_cell_id))))
        .reduce((acc, cell_id) =>
        {
            const net = (grid.supply_MW_by_cell_id[cell_id] || 0) - (grid.demand_MW_by_cell_id[cell_id] || 0)
            acc[cell_id] = net
            return acc
        }, {} as Record<string, number>)
}


/**
 * Changes the supply or demand of a cell so its net MW changes by change_MW.
 * A decrease reduces supply first, and any shortfall is added to demand.
 */
export function change_cell_MW(
    grid: Pick<PoweredCellularElectricalGrid, "supply_MW_by_cell_id" | "demand_MW_by_cell_id">,
    cell_id: string,
    change_MW: number
): void
{
    const demand = grid.demand_MW_by_cell_id[cell_id] || 0
    const supply = grid.supply_MW_by_cell_id[cell_id] || 0

    if (change_MW > 0) grid.supply_MW_by_cell_id[cell_id] = supply + change_MW
    else if (change_MW < 0)
    {
        let remaining = -change_MW
        if (supply > 0)
        {
            const change_supply = Math.min(supply, -change_MW)
            grid.supply_MW_by_cell_id[cell_id] = supply - change_supply

            remaining -= change_supply
        }
        grid.demand_MW_by_cell_id[cell_id] = demand + remaining
    }
}
