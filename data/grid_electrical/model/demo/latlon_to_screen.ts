import type { CellularElectricalGrid, ILatLon } from "../src/interface.ts"


export interface ProjectLatLon
{
    (latlon: ILatLon): { x: number, y: number }
}
export interface ProjectCellId
{
    (cell_id: string): { x: number, y: number }
}

interface GridToScreenArgs
{
    grid: CellularElectricalGrid
    width: number
    height: number
    spread: number
    cell_id_to_latlon: (cell_id: string) => ILatLon
}
interface GridToScreenResult
{
    project: ProjectCellId
    project_latlon_to_xy: ProjectLatLon
    home_view: { x: number, y: number, w: number, h: number }
}
export function grid_to_screen(args: GridToScreenArgs): GridToScreenResult
{
    const { grid, width, height, spread } = args

    const bbox = get_grid_bounding_box(grid, args.cell_id_to_latlon)

    const { min_lat, max_lat, min_lon, max_lon } = bbox

    // Scale longitude by cos(latitude) so one degree looks similar east-west and north-south
    const lon_factor = Math.cos((((min_lat + max_lat) / 2) * Math.PI) / 180)
    const span_x = (max_lon - min_lon) * lon_factor
    const span_y = max_lat - min_lat

    const padding = 40
    const available_w = width - 2 * padding
    const available_h = height - 2 * padding
    const fit_scale = Math.min(
        span_x > 0 ? available_w / span_x : Infinity,
        span_y > 0 ? available_h / span_y : Infinity,
    )
    // Spreads the grid beyond the visible area so elements appear smaller relative to each other when fully zoomed out
    const scale = (Number.isFinite(fit_scale) ? fit_scale : 1) * spread
    const offset_x = (width - span_x * scale) / 2
    const offset_y = (height - span_y * scale) / 2

    const project_latlon_to_xy: ProjectLatLon = ({ lat, lon }) => ({
        x: (lon - min_lon) * lon_factor * scale + offset_x,
        y: (max_lat - lat) * scale + offset_y,
    })

    const project: ProjectCellId = (cell_id: string) => {
        const latlon = args.cell_id_to_latlon(cell_id)
        return project_latlon_to_xy(latlon)
    }

    // Centred on the screen, and large enough to contain the whole spread grid
    const home_view = {
        x: (width - width * spread) / 2,
        y: (height - height * spread) / 2,
        w: width * spread,
        h: height * spread,
    }

    return { project, project_latlon_to_xy, home_view }
}


interface BoundingBox
{
    min_lat: number
    max_lat: number
    min_lon: number
    max_lon: number
}

function get_grid_bounding_box(grid: CellularElectricalGrid, cell_id_to_latlon: (cell_id: string) => ILatLon): BoundingBox
{
    const all_points: ILatLon[] = [
        ...grid.buses.map(bus => cell_id_to_latlon(bus.cell_id)),
        ...grid.ac_lines.flatMap(line => line.path_cell_ids.map(cell_id_to_latlon)),
        ...grid.dc_links.flatMap(link => link.path_cell_ids.map(cell_id_to_latlon)),
    ]

    let min_lat = Infinity
    let max_lat = -Infinity
    let min_lon = Infinity
    let max_lon = -Infinity

    for (const point of all_points)
    {
        min_lat = Math.min(min_lat, point.lat)
        max_lat = Math.max(max_lat, point.lat)
        min_lon = Math.min(min_lon, point.lon)
        max_lon = Math.max(max_lon, point.lon)
    }

    return { min_lat, max_lat, min_lon, max_lon }
}
