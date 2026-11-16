import type { LatLonElectricalGrid } from "./interface.ts"


/** [from_bus_id, to_bus_id, x_pu, capacity_mw (default unlimited)] */
export type TestAcLine = [string, string, number, number?]
/** [from_bus_id, to_bus_id, capacity_mw (default unlimited)] */
export type TestDcLink = [string, string, number?]


/** Busses are named "0", "1", ... and all sit at the same location */
export function create_test_grid(ac_lines: TestAcLine[], dc_links: TestDcLink[] = []): LatLonElectricalGrid
{
    let bus_ids = [
        ...ac_lines.flatMap(([from_bus_id, to_bus_id]) => [from_bus_id, to_bus_id]),
        ...dc_links.flatMap(([from_bus_id, to_bus_id]) => [from_bus_id, to_bus_id]),
    ]
    bus_ids = Array.from(new Set(bus_ids))

    return {
        buses: bus_ids.map((id, i) => ({ id, latlon: { lat: i, lon: 0 } })),
        ac_lines: ac_lines.map(([from_bus_id, to_bus_id, x_pu, capacity_mw = Infinity], index) =>
            ({ id: `${index}`, from_bus_id, to_bus_id, path_latlon: [], capacity_mw, x_pu, voltage_kv: 400 })),
        dc_links: dc_links.map(([from_bus_id, to_bus_id, capacity_mw = Infinity], index) =>
            ({ id: `${index}`, from_bus_id, to_bus_id, path_latlon: [], capacity_mw, voltage_kv: 400 })),
    }
}


/**
 * For these tests, we use an orthogonal grid where the cell_id is given
 * by letters (horizontal position) and numbers (vertical) i.e. similar to a
 * spreadsheet:
 *
 *        a   b   c   d   e   f   g   h
 *     1  a1  b1  c1  d1  e1  f1  g1  h1
 *     2  a2  b2  c2  d2  e2  f2  g2  h2
 *     3  a3  b3  c3  d3  e3  f3  g3  h3
 *     4  a4  b4  c4  d4  e4  f4  g4  h4
 */
export function orthogonal_neighbour_cell_ids(cell_id: string): string[]
{
    const [, column, row_str] = cell_id.match(/^([a-z])(\d+)$/)!
    const row = parseInt(row_str!, 10)
    const column_code = column!.charCodeAt(0)
    return [
        `${String.fromCharCode((column_code - 1 + 26 - 97) % 26 + 97)}${row}`,
        `${String.fromCharCode((column_code + 1 + 26 - 97) % 26 + 97)}${row}`,
        `${column}${(row - 1 + 10) % 10}`,
        `${column}${(row + 1 + 10) % 10}`,
    ]
}
