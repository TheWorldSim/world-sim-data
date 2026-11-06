import type { Bus, ElectricalGrid, ACLine, DCLink, ILatLon, LatLonToCell } from "./interface.ts"


/**
 * Merges all busses within the same cell into the first bus seen in that cell
 * (which also provides the cell's representative location), re-points lines at
 * the merged busses and drops lines that start and end in the same cell.
 */
export function aggregate_grid_to_cells(grid: ElectricalGrid, latlon_to_cell: LatLonToCell): ElectricalGrid
{
    const { busses, bus_id_to_merged_id } = aggregate_busses_to_cells(grid.busses, latlon_to_cell)

    function get_merged_bus_id(bus_id: string): string
    {
        const merged_id = bus_id_to_merged_id.get(bus_id)
        if (merged_id === undefined) throw new Error(`Failed to find bus with id: ${bus_id}`)
        return merged_id
    }

    const ac_lines: ACLine[] = aggregate_ac_lines_to_cells(grid.ac_lines, get_merged_bus_id, latlon_to_cell)
    const dc_links: DCLink[] = aggregate_dc_links_to_cells(grid.dc_links, get_merged_bus_id, latlon_to_cell)

    return { busses, ac_lines, dc_links }
}


function aggregate_busses_to_cells(busses: Bus[], latlon_to_cell: LatLonToCell)
{
    const merged_bus_by_cell_id = new Map<string, Bus>()
    const bus_id_to_merged_id = new Map<string, string>()

    for (const bus of busses)
    {
        const cell_id = latlon_to_cell.to_cell_id(bus.latlon)
        let merged_bus = merged_bus_by_cell_id.get(cell_id)
        if (!merged_bus)
        {
            merged_bus = { id: bus.id, latlon: latlon_to_cell.round_to_cell_centre(bus.latlon) }
            merged_bus_by_cell_id.set(cell_id, merged_bus)
        }
        bus_id_to_merged_id.set(bus.id, merged_bus.id)
    }

    return { busses: Array.from(merged_bus_by_cell_id.values()), bus_id_to_merged_id }
}


function aggregate_ac_lines_to_cells(lines: ACLine[], get_merged_bus_id: (bus_id: string) => string, latlon_to_cell: LatLonToCell): ACLine[]
{
    const aggregated: ACLine[] = []
    for (const line of lines)
    {
        const from_bus_id = get_merged_bus_id(line.from_bus_id)
        const to_bus_id = get_merged_bus_id(line.to_bus_id)
        if (from_bus_id === to_bus_id) continue

        aggregated.push({ ...line, from_bus_id, to_bus_id, path: snap_path_to_cells(line.path, latlon_to_cell) })
    }
    return aggregated
}


function aggregate_dc_links_to_cells(links: DCLink[], get_merged_bus_id: (bus_id: string) => string, latlon_to_cell: LatLonToCell): DCLink[]
{
    const aggregated: DCLink[] = []
    for (const link of links)
    {
        const from_bus_id = get_merged_bus_id(link.from_bus_id)
        const to_bus_id = get_merged_bus_id(link.to_bus_id)
        if (from_bus_id === to_bus_id) continue

        aggregated.push({ ...link, from_bus_id, to_bus_id, path: snap_path_to_cells(link.path, latlon_to_cell) })
    }
    return aggregated
}


// Each cell is represented by a single location so that lines meet at merged busses
function snap_path_to_cells(path: ILatLon[], latlon_to_cell: LatLonToCell): ILatLon[]
{
    const snapped: ILatLon[] = []
    for (const latlon of path)
    {
        const cell_centre = latlon_to_cell.round_to_cell_centre(latlon)
        const last = snapped[snapped.length - 1]
        if (last && last.lat === cell_centre.lat && last.lon === cell_centre.lon) continue
        snapped.push(cell_centre)
    }

    return snapped
}
