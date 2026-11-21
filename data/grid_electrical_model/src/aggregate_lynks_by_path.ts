import type { CellularACLine, CellularDCLink, CellularElectricalGrid, CellularLynk } from "./interface.ts"


/** Groups ac lines and dc links by the cell to cell segments of their paths.
 * A lynk takes the direction of the first member that uses its segment.
 * A member's direction is 1 when it runs the same way as the lynk's path_cell_ids, otherwise -1. */
export function aggregate_lynks_by_path(grid: CellularElectricalGrid): CellularLynk[]
{
    const lynk_by_segment_key = new Map<string, CellularLynk>()

    grid.ac_lines.forEach(line => add_to_lynks(lynk_by_segment_key, line, "ac_lines"))
    grid.dc_links.forEach(link => add_to_lynks(lynk_by_segment_key, link, "dc_links"))

    return Array.from(lynk_by_segment_key.values())
}


function add_to_lynks(lynk_by_segment_key: Map<string, CellularLynk>, line_or_link: (CellularACLine | CellularDCLink), kind: "ac_lines" | "dc_links")
{
    for (const [from_cell_id, to_cell_id] of path_segments(line_or_link.path_cell_ids))
    {
        const lynk = get_lynk(lynk_by_segment_key, from_cell_id, to_cell_id)
        const members = lynk[kind]
        if (members[members.length - 1]?.id === line_or_link.id) continue

        const direction = from_cell_id === lynk.path_cell_ids[0] ? 1 : -1
        members.push({ id: line_or_link.id, direction })

        lynk.capacity_mw += line_or_link.capacity_mw
    }
}


function path_segments(path_cell_ids: string[]): [string, string][]
{
    return path_cell_ids.slice(1).map((to_cell_id, i) => [path_cell_ids[i]!, to_cell_id])
}

function get_lynk(lynk_by_segment_key: Map<string, CellularLynk>, from_cell_id: string, to_cell_id: string): CellularLynk
{
    const segment_key = JSON.stringify([from_cell_id, to_cell_id].sort())
    let lynk = lynk_by_segment_key.get(segment_key)
    if (!lynk)
    {
        lynk = {
            lynk_id: lynk_by_segment_key.size,
            capacity_mw: 0,
            path_cell_ids: [from_cell_id, to_cell_id],
            ac_lines: [],
            dc_links: []
        }
        lynk_by_segment_key.set(segment_key, lynk)
    }
    return lynk
}
