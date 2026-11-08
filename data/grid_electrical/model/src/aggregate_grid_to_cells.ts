import type {
    LatLonBus,
    LatLonElectricalGrid,
    CellularACLine,
    CellularDCLink,
    ILatLon,
    ConvertLatLonToFromCell,
    CellularElectricalGrid,
    CellularBus,
    LatLonACLine,
    LatLonDCLink,
} from "./interface.ts"


/**
 * Merges all buses within the same cell into the first bus seen in that cell
 * (which also provides the cell's representative location), re-points lines at
 * the merged buses and drops lines that start and end in the same cell.
 */
export function aggregate_grid_to_cells(grid: LatLonElectricalGrid, latlon_to_cell: ConvertLatLonToFromCell): CellularElectricalGrid
{
    const { buses, bus_id_to_merged_id } = aggregate_buses_to_cells(grid.buses, latlon_to_cell)

    function get_merged_bus_id(bus_id: string): string
    {
        const merged_id = bus_id_to_merged_id.get(bus_id)
        if (merged_id === undefined) throw new Error(`Failed to find bus with id: ${bus_id}`)
        return merged_id
    }

    const ac_lines: CellularACLine[] = aggregate_ac_lines_to_cells(grid.ac_lines, get_merged_bus_id, latlon_to_cell)
    const dc_links: CellularDCLink[] = aggregate_dc_links_to_cells(grid.dc_links, get_merged_bus_id, latlon_to_cell)

    const bus_by_bus_id = new Map(buses.map(bus => [bus.id, bus]))
    function bus_id_to_cell_id(bus_id: string): string
    {
        const merged_id = bus_id_to_merged_id.get(bus_id)
        if (merged_id === undefined) throw new Error(`Failed to find bus with id: ${bus_id}`)
        const bus = bus_by_bus_id.get(merged_id)
        if (!bus) throw new Error(`Failed to find merged bus with id: ${merged_id}`)
        return bus.cell_id
    }

    return { buses, ac_lines, dc_links, bus_id_to_cell_id }
}


function aggregate_buses_to_cells(buses: LatLonBus[], latlon_to_from_cell: ConvertLatLonToFromCell)
{
    const merged_bus_by_cell_id = new Map<string, CellularBus>()
    const bus_id_to_merged_id = new Map<string, string>()

    for (const bus of buses)
    {
        const cell_id = latlon_to_from_cell.latlon_to_cell_id(bus.latlon)
        let merged_bus = merged_bus_by_cell_id.get(cell_id)
        if (!merged_bus)
        {
            merged_bus = {
                id: bus.id,
                cell_id,
            }
            merged_bus_by_cell_id.set(cell_id, merged_bus)
        }
        bus_id_to_merged_id.set(bus.id, merged_bus.id)
    }

    return { buses: Array.from(merged_bus_by_cell_id.values()), bus_id_to_merged_id }
}


function aggregate_ac_lines_to_cells(lines: LatLonACLine[], get_merged_bus_id: (bus_id: string) => string, latlon_to_cell: ConvertLatLonToFromCell): CellularACLine[]
{
    const aggregated: CellularACLine[] = []
    for (const line of lines)
    {
        const from_bus_id = get_merged_bus_id(line.from_bus_id)
        const to_bus_id = get_merged_bus_id(line.to_bus_id)
        if (from_bus_id === to_bus_id) continue

        aggregated.push({
            id: line.id,
            from_bus_id,
            to_bus_id,
            path_cell_ids: aggregate_path_to_cell_ids(line.path_latlon, latlon_to_cell),
            capacity_mw: line.capacity_mw,
            x_pu: line.x_pu,
            voltage_kv: line.voltage_kv,
        })
    }
    return aggregated
}


function aggregate_dc_links_to_cells(links: LatLonDCLink[], get_merged_bus_id: (bus_id: string) => string, latlon_to_cell: ConvertLatLonToFromCell): CellularDCLink[]
{
    const aggregated: CellularDCLink[] = []
    for (const link of links)
    {
        const from_bus_id = get_merged_bus_id(link.from_bus_id)
        const to_bus_id = get_merged_bus_id(link.to_bus_id)
        if (from_bus_id === to_bus_id) continue

        aggregated.push({
            id: link.id,
            from_bus_id,
            to_bus_id,
            path_cell_ids: aggregate_path_to_cell_ids(link.path_latlon, latlon_to_cell),
            capacity_mw: link.capacity_mw,
            voltage_kv: link.voltage_kv,
        })
    }
    return aggregated
}


// Each cell is represented by a single location so that lines meet at merged buses
function aggregate_path_to_cell_ids(path: ILatLon[], latlon_to_from_cell: ConvertLatLonToFromCell): string[]
{
    const cell_ids: string[] = []
    for (const latlon of path)
    {
        const cell_id = latlon_to_from_cell.latlon_to_cell_id(latlon)
        const last = cell_ids[cell_ids.length - 1]
        if (last && last === cell_id) continue
        cell_ids.push(cell_id)
    }

    return cell_ids
}
