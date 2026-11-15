import type { CommonBus, DistributionGrid, DistributionGridConfig } from "./interface.ts"


/**
 * Connects each cell without a bus to its nearest bus, one hop at a time, where the capacity of a hop depends on
 * how many hops it is from the bus.  The search is breadth first from all buses at once, visiting cells in sorted
 * order, so every cell gets exactly one parent and the result is deterministic.
 */
export function build_distribution_grid(
    buses: CommonBus[],
    config: DistributionGridConfig | undefined,
): DistributionGrid
{
    const distribution: DistributionGrid = { buses: [], dc_links: [], cell_ids: [] }
    if (!config) return distribution

    const cell_id_to_bus_id_map = new Map<string, string>()
    for (const bus of buses)
    {
        // CellularBus has a cell_id field; CommonBus doesn't, so we need to handle both
        const cell_id = (bus as any).cell_id
        if (!cell_id) continue
        if (!cell_id_to_bus_id_map.has(cell_id)) cell_id_to_bus_id_map.set(cell_id, bus.id)
        else throw new Error(`Multiple buses for cell ${cell_id}. Already have bus ${cell_id_to_bus_id_map.get(cell_id)}, and also trying to add bus ${bus.id}. Remove one of them.`)
    }
    const cell_id_to_bus_id = (cell_id: string) => cell_id_to_bus_id_map.get(cell_id) ?? `distribution:${cell_id}`

    const hops_by_cell_id = new Map<string, number>()
    const parent_cell_id_by_cell_id = new Map<string, string>()
    let frontier = [...cell_id_to_bus_id_map.keys()].sort()
    frontier.forEach(cell_id => hops_by_cell_id.set(cell_id, 0))

    for (let hops = 1; hops <= config.hop_capacity_MW.length; ++hops)
    {
        const next_frontier: string[] = []
        for (const cell_id of frontier)
        {
            for (const neighbour_cell_id of [...config.neighbour_cell_ids(cell_id)].sort())
            {
                if (hops_by_cell_id.has(neighbour_cell_id)) continue
                hops_by_cell_id.set(neighbour_cell_id, hops)
                parent_cell_id_by_cell_id.set(neighbour_cell_id, cell_id)
                next_frontier.push(neighbour_cell_id)
            }
        }
        frontier = next_frontier
    }

    for (const [cell_id, hops] of hops_by_cell_id)
    {
        if (hops === 0) continue

        const bus_id = cell_id_to_bus_id(cell_id)
        const parent_bus_id = cell_id_to_bus_id(parent_cell_id_by_cell_id.get(cell_id)!)

        distribution.buses.push({ id: bus_id })
        distribution.cell_ids.push(cell_id)
        distribution.dc_links.push({
            id: `${bus_id}->${parent_bus_id}`,
            from_bus_id: bus_id,
            to_bus_id: parent_bus_id,
            capacity_mw: config.hop_capacity_MW[hops - 1]!,
            voltage_kv: 0,
        })
    }

    return distribution
}
