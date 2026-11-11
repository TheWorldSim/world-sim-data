import type { CellularElectricalGrid } from "./interface.ts"


export function modify_grid(cellular_grid: CellularElectricalGrid)
{
    // A fudge to map cells in France, Belgium and the Netherlands
    // to be on land instead of in the sea.
    const cell_ids_map: Record<string, string> = {
        "8419481ffffffff": "841948bffffffff",
        "84194ddffffffff": "84194d1ffffffff",
        "84196b1ffffffff": "84196bbffffffff",
    }

    function change_cell_id(cell_id: string): string
    {
        return cell_ids_map[cell_id] || cell_id
    }

    cellular_grid.buses.forEach(bus => {
        bus.cell_id = change_cell_id(bus.cell_id)
    })
    cellular_grid.ac_lines.forEach(line => {
        line.path_cell_ids = line.path_cell_ids.map(change_cell_id)
    })
    cellular_grid.dc_links.forEach(link => {
        link.path_cell_ids = link.path_cell_ids.map(change_cell_id)
    })

    return cellular_grid
}
