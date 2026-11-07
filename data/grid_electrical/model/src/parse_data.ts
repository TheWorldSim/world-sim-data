import type { Bus, ElectricalGrid, ACLine, DCLink, ILatLon } from "./interface.ts"
import { d1258v6_parse_csv } from "./d1258v6_parse_csv.js"


export interface GridCsvData
{
    busses: string
    ac_lines: string
    dc_links: string
}


export function parse_grid_csv_data(data: GridCsvData): ElectricalGrid
{
    const busses: Bus[] = parse_busses(data.busses)
    const bus_by_id = Object.fromEntries(busses.map(bus => [bus.id, bus]))

    const ac_lines: ACLine[] = parse_ac_lines(data.ac_lines, bus_by_id)
    const dc_links: DCLink[] = parse_dc_links(data.dc_links, bus_by_id)

    return { busses, ac_lines, dc_links }
}


function parse_busses(csv: string): Bus[]
{
    const raw_rows = d1258v6_parse_csv(csv) as string[][]
    if (raw_rows.length === 0) return []

    const [headers, ...rows] = raw_rows
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


function parse_ac_lines(csv: string, bus_by_id: Record<string, Bus>): ACLine[]
{
    const raw_rows = d1258v6_parse_csv(csv) as string[][]
    if (raw_rows.length === 0) return []

    const [headers, ...rows] = raw_rows
    const header_indices = {
        id: headers.indexOf("line_id"),
        bus0: headers.indexOf("bus0"),
        bus1: headers.indexOf("bus1"),
        voltage: headers.indexOf("voltage"),
        s_nom: headers.indexOf("s_nom"),
        x_pu: headers.indexOf("x_pu"),
        geometry: headers.indexOf("geometry"),
    }

    return rows.map(row => parse_ac_line(row, header_indices, bus_by_id))
}


function parse_ac_line(row: (string | number)[], header_indices: Record<string, number>, bus_by_id: Record<string, Bus>): ACLine
{
    const from_bus_id = String(row[header_indices.bus0])
    const to_bus_id = String(row[header_indices.bus1])
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

    return {
        id: String(row[header_indices.id]),
        from_bus_id,
        to_bus_id,
        path: parse_geometry(String(row[header_indices.geometry]), from_bus, to_bus),
        capacity_mw: Number(row[header_indices.s_nom]),
        x_pu: Number(row[header_indices.x_pu]),
        voltage_kv: Number(row[header_indices.voltage]),
    }
}


function parse_dc_links(csv: string, bus_by_id: Record<string, Bus>): DCLink[]
{
    const raw_rows = d1258v6_parse_csv(csv) as string[][]
    if (raw_rows.length === 0) return []

    const [headers, ...rows] = raw_rows
    const header_indices = {
        id: headers.indexOf("link_id"),
        bus0: headers.indexOf("bus0"),
        bus1: headers.indexOf("bus1"),
        voltage: headers.indexOf("voltage"),
        p_nom: headers.indexOf("p_nom"),
        geometry: headers.indexOf("geometry"),
    }

    return rows.map(row => parse_dc_link(row, header_indices, bus_by_id))
}


function parse_dc_link(row: (string | number)[], header_indices: Record<string, number>, bus_by_id: Record<string, Bus>): DCLink
{
    const from_bus_id = String(row[header_indices.bus0])
    const to_bus_id = String(row[header_indices.bus1])
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

    return {
        id: String(row[header_indices.id]),
        from_bus_id,
        to_bus_id,
        path: parse_geometry(String(row[header_indices.geometry]), from_bus, to_bus),
        capacity_mw: Number(row[header_indices.p_nom]),
        voltage_kv: Number(row[header_indices.voltage]),
    }
}


function parse_geometry(geometry: string, from_bus: Bus, to_bus: Bus): ILatLon[]
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
        match_linestring[1].split(",").forEach(coord =>
        {
            const [lon, lat] = coord.trim().split(/\s+/).map(safe_parse_float)
            add_coord({ lon, lat })
        })
    }

    if (match_point)
    {
        const lon = safe_parse_float(match_point[1])
        const lat = safe_parse_float(match_point[2])
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
