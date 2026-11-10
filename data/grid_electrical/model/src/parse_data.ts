import { d1258v6_parse_csv } from "./d1258v6_parse_csv.js"
import type { CellularACLine, CellularBus, CellularDCLink, CellularElectricalGrid, ILatLon, LatLonACLine, LatLonBus, LatLonDCLink, LatLonElectricalGrid } from "./interface.ts"


export interface GridCsvData
{
    buses: string
    ac_lines: string
    dc_links: string
}


export function parse_latlon_grid_csv_data(data: GridCsvData): LatLonElectricalGrid
{
    const buses: LatLonBus[] = parse_latlon_buses(data.buses)
    const bus_by_id = Object.fromEntries(buses.map(bus => [bus.id, bus]))

    const ac_lines: LatLonACLine[] = parse_latlon_ac_lines(data.ac_lines, bus_by_id)
    const dc_links: LatLonDCLink[] = parse_latlon_dc_links(data.dc_links, bus_by_id)

    return { buses, ac_lines, dc_links }
}


export function parse_cellular_grid_csv_data(data: GridCsvData): CellularElectricalGrid
{
    const buses: CellularBus[] = parse_cellular_buses(data.buses)
    const bus_by_id = Object.fromEntries(buses.map(bus => [bus.id, bus]))

    const ac_lines: CellularACLine[] = parse_cellular_ac_lines(data.ac_lines, bus_by_id)
    const dc_links: CellularDCLink[] = parse_cellular_dc_links(data.dc_links, bus_by_id)

    function bus_id_to_cell_id(bus_id: string): string
    {
        const bus = bus_by_id[bus_id]
        if (!bus) throw new Error(`Failed to find bus with id: ${bus_id}`)
        return bus.cell_id
    }

    return { buses, ac_lines, dc_links, bus_id_to_cell_id }
}


function parse_latlon_buses(csv: string): LatLonBus[]
{
    const raw_rows = d1258v6_parse_csv(csv)
    if (raw_rows.length === 0) return []

    const [headers, ...rows] = raw_rows as [string[], ...(string | number)[][]]
    const header_indices = {
        bus_id: headers.indexOf("bus_id"),
        lon: headers.indexOf("lon"),
        lat: headers.indexOf("lat"),
    }

    return rows.map(row => ({
        id: String(row[header_indices.bus_id]),
        latlon: {
            lat: Number(row[header_indices.lat]),
            lon: Number(row[header_indices.lon]),
        },
    }))
}


function parse_cellular_buses(csv: string): CellularBus[]
{
    const raw_rows = d1258v6_parse_csv(csv)
    if (raw_rows.length === 0) return []

    const [headers, ...rows] = raw_rows as [string[], ...(string | number)[][]]
    const header_indices = {
        bus_id: headers.indexOf("bus_id"),
        cell_id: headers.indexOf("cell_id"),
    }

    return rows.map(row => ({
        id: String(row[header_indices.bus_id]),
        cell_id: String(row[header_indices.cell_id]),
    }))
}


interface ACLineHeaders
{
    id: number
    bus0: number
    bus1: number
    voltage: number
    s_nom: number
    x_pu: number
    geometry: number
}
function parse_ac_line_rows(csv: string): { header_indices: ACLineHeaders, rows: (string | number)[][] }
{
    const raw_rows = d1258v6_parse_csv(csv)
    if (raw_rows.length === 0) return { header_indices: {} as ACLineHeaders, rows: [] }

    const [headers, ...rows] = raw_rows as [string[], ...(string | number)[][]]
    const header_indices: ACLineHeaders = {
        id: headers.indexOf("line_id"),
        bus0: headers.indexOf("bus0"),
        bus1: headers.indexOf("bus1"),
        voltage: headers.indexOf("voltage"),
        s_nom: headers.indexOf("s_nom"),
        x_pu: headers.indexOf("x_pu"),
        geometry: headers.indexOf("geometry"),
    }

    return { header_indices, rows }
}


function get_bus_pair<B>(row: (string | number)[], bus0_index: number, bus1_index: number, bus_by_id: Record<string, B>)
{
    const from_bus_id = String(row[bus0_index])
    const to_bus_id = String(row[bus1_index])
    const from_bus = bus_by_id[from_bus_id]
    const to_bus = bus_by_id[to_bus_id]

    if (!from_bus)
    {
        throw new Error(`Failed to find from_bus with id: ${from_bus_id}`)
    }
    if (!to_bus)
    {
        throw new Error(`Failed to find to_bus with id: ${to_bus_id}`)
    }

    return { from_bus_id, to_bus_id, from_bus, to_bus }
}


function parse_latlon_ac_lines(csv: string, bus_by_id: Record<string, LatLonBus>): LatLonACLine[]
{
    const { header_indices, rows } = parse_ac_line_rows(csv)

    return rows.map(row =>
    {
        const { from_bus_id, to_bus_id, from_bus, to_bus } = get_bus_pair(row, header_indices.bus0, header_indices.bus1, bus_by_id)

        return {
            id: String(row[header_indices.id]),
            from_bus_id,
            to_bus_id,
            path_latlon: parse_latlon_geometry(String(row[header_indices.geometry]), from_bus, to_bus),
            capacity_mw: Number(row[header_indices.s_nom]),
            x_pu: Number(row[header_indices.x_pu]),
            voltage_kv: Number(row[header_indices.voltage]),
        }
    })
}


function parse_cellular_ac_lines(csv: string, bus_by_id: Record<string, CellularBus>): CellularACLine[]
{
    const { header_indices, rows } = parse_ac_line_rows(csv)

    return rows.map(row =>
    {
        const { from_bus_id, to_bus_id, from_bus, to_bus } = get_bus_pair(row, header_indices.bus0, header_indices.bus1, bus_by_id)

        return {
            id: String(row[header_indices.id]),
            from_bus_id,
            to_bus_id,
            path_cell_ids: parse_cellular_geometry(String(row[header_indices.geometry]), from_bus, to_bus),
            capacity_mw: Number(row[header_indices.s_nom]),
            x_pu: Number(row[header_indices.x_pu]),
            voltage_kv: Number(row[header_indices.voltage]),
        }
    })
}


interface DCLinkHeaders
{
    id: number
    bus0: number
    bus1: number
    voltage: number
    p_nom: number
    geometry: number
}
function parse_dc_link_rows(csv: string): { header_indices: DCLinkHeaders, rows: (string | number)[][] }
{
    const raw_rows = d1258v6_parse_csv(csv)
    if (raw_rows.length === 0) return { header_indices: {} as DCLinkHeaders, rows: [] }

    const [headers, ...rows] = raw_rows as [string[], ...(string | number)[][]]
    const header_indices: DCLinkHeaders = {
        id: headers.indexOf("link_id"),
        bus0: headers.indexOf("bus0"),
        bus1: headers.indexOf("bus1"),
        voltage: headers.indexOf("voltage"),
        p_nom: headers.indexOf("p_nom"),
        geometry: headers.indexOf("geometry"),
    }

    return { header_indices, rows }
}


function parse_latlon_dc_links(csv: string, bus_by_id: Record<string, LatLonBus>): LatLonDCLink[]
{
    const { header_indices, rows } = parse_dc_link_rows(csv)

    return rows.map(row =>
    {
        const { from_bus_id, to_bus_id, from_bus, to_bus } = get_bus_pair(row, header_indices.bus0, header_indices.bus1, bus_by_id)

        return {
            id: String(row[header_indices.id]),
            from_bus_id,
            to_bus_id,
            path_latlon: parse_latlon_geometry(String(row[header_indices.geometry]), from_bus, to_bus),
            capacity_mw: Number(row[header_indices.p_nom]),
            voltage_kv: Number(row[header_indices.voltage]),
        }
    })
}


function parse_cellular_dc_links(csv: string, bus_by_id: Record<string, CellularBus>): CellularDCLink[]
{
    const { header_indices, rows } = parse_dc_link_rows(csv)

    return rows.map(row =>
    {
        const { from_bus_id, to_bus_id, from_bus, to_bus } = get_bus_pair(row, header_indices.bus0, header_indices.bus1, bus_by_id)

        return {
            id: String(row[header_indices.id]),
            from_bus_id,
            to_bus_id,
            path_cell_ids: parse_cellular_geometry(String(row[header_indices.geometry]), from_bus, to_bus),
            capacity_mw: Number(row[header_indices.p_nom]),
            voltage_kv: Number(row[header_indices.voltage]),
        }
    })
}


function parse_cellular_geometry(geometry: string, from_bus: CellularBus, to_bus: CellularBus): string[]
{
    const cell_ids: string[] = []
    function add_cell_id(cell_id: string)
    {
        if (cell_ids[cell_ids.length - 1] === cell_id) return
        cell_ids.push(cell_id)
    }

    add_cell_id(from_bus.cell_id)
    geometry.split(",").map(cell_id => cell_id.trim()).filter(cell_id => cell_id).forEach(add_cell_id)
    add_cell_id(to_bus.cell_id)

    return cell_ids
}


function parse_latlon_geometry(geometry: string, from_bus: LatLonBus, to_bus: LatLonBus): ILatLon[]
{
    geometry = geometry.trim()

    const coords: ILatLon[] = []
    function add_coord({ lon, lat }: ILatLon)
    {
        const last_point = coords[coords.length - 1]
        if (last_point && last_point.lon === lon && last_point.lat === lat) return
        coords.push({ lon, lat })
    }

    add_coord({ ...from_bus.latlon })

    const match_linestring = /^LINESTRING\s*\(([^()]*)\)$/i.exec(geometry)
    const match_point = /^\['POINT\s*\(\s*(\d+)\s*(\d+)\s*\)'\]$/i.exec(geometry)

    if (match_linestring)
    {
        match_linestring[1]!.split(",").forEach(coord =>
        {
            const [lon, lat] = coord.trim().split(/\s+/).map(safe_parse_float) as [number, number]
            add_coord({ lon, lat })
        })
    }

    if (match_point)
    {
        const lon = safe_parse_float(match_point[1]!)
        const lat = safe_parse_float(match_point[2]!)
        add_coord({ lon, lat })
    }

    add_coord({ ...to_bus.latlon })

    return coords
}


function safe_parse_float(value: string): number
{
    const parsed = parseFloat(value)
    if (isNaN(parsed))
    {
        throw new Error(`Failed to parse float from value: ${value}`)
    }
    return parsed
}
