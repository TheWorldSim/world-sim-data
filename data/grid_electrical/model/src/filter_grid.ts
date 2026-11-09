import type { CommonElectricalGrid } from "./interface.ts"


export interface GridFilter
{
    start_bus_id: string
    stop_bus_ids: Set<string>
}

export function filter_grid<G extends CommonElectricalGrid>(grid: G, filter: GridFilter | undefined): G
{
    if (!filter) return grid

    const kept_bus_ids = find_reachable_bus_ids(grid, filter)
    const is_kept = (bus_id: string) => kept_bus_ids.has(bus_id)

    return {
        ...grid,
        buses: grid.buses.filter(bus => is_kept(bus.id)),
        ac_lines: grid.ac_lines.filter(line => is_kept(line.from_bus_id) && is_kept(line.to_bus_id)),
        dc_links: grid.dc_links.filter(link => is_kept(link.from_bus_id) && is_kept(link.to_bus_id)),
    }
}


function find_reachable_bus_ids<G extends CommonElectricalGrid>(grid: G, filter: GridFilter): Set<string>
{
    const neighbour_ids_by_bus_id = new Map<string, string[]>()
    for (const { from_bus_id, to_bus_id } of [...grid.ac_lines, ...grid.dc_links])
    {
        add_neighbour(neighbour_ids_by_bus_id, from_bus_id, to_bus_id)
        add_neighbour(neighbour_ids_by_bus_id, to_bus_id, from_bus_id)
    }

    const reached = new Set<string>([filter.start_bus_id])
    const to_visit = [filter.start_bus_id]
    while (to_visit.length > 0)
    {
        const bus_id = to_visit.pop()!
        if (filter.stop_bus_ids.has(bus_id)) continue

        for (const neighbour_id of neighbour_ids_by_bus_id.get(bus_id) ?? [])
        {
            if (reached.has(neighbour_id)) continue
            reached.add(neighbour_id)
            to_visit.push(neighbour_id)
        }
    }

    return reached
}


function add_neighbour(neighbour_ids_by_bus_id: Map<string, string[]>, bus_id: string, neighbour_id: string)
{
    const neighbour_ids = neighbour_ids_by_bus_id.get(bus_id)
    if (neighbour_ids) neighbour_ids.push(neighbour_id)
    else neighbour_ids_by_bus_id.set(bus_id, [neighbour_id])
}
