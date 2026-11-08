import type { ConvertLatLonToFromCell } from "./interface.ts"


/**
 * Simple 1 degree cells, e.g. "11,19"
 * Default implementation, would normally be replaced by something using a
 * library like h3geo or dggal https://github.com/ecere/dggal/#installation-from-npm
 */
export const latlon_to_from_cell: ConvertLatLonToFromCell = {
    round_latlon_to_cell_centre: (latlon) => ({ lat: Math.round(latlon.lat), lon: Math.round(latlon.lon) }),
    latlon_to_cell_id: (latlon) => `${Math.round(latlon.lat)}_${Math.round(latlon.lon)}`,
    cell_id_to_latlon: (cell_id) =>
    {
        const [lat, lon] = cell_id.split("_").map(Number)
        return { lat, lon }
    }
}
