import { cellToLatLng, gridDisk, latLngToCell } from "h3-js"

import type { ConvertLatLonToFromCell } from "./interface.ts"


/**
 * Simple 1 degree cells, e.g. "11,19"
 */
export const latlon_to_from_cell_1dp: ConvertLatLonToFromCell = {
    round_latlon_to_cell_centre: (latlon) => ({ lat: Math.round(latlon.lat), lon: Math.round(latlon.lon) }),
    latlon_to_cell_id: (latlon) => `${Math.round(latlon.lat)}_${Math.round(latlon.lon)}`,
    cell_id_to_latlon: (cell_id) =>
    {
        const [lat, lon] = cell_id.split("_").map(Number) as [number, number]
        return { lat, lon }
    },
    neighbour_cell_ids: (cell_id) =>
    {
        const [lat, lon] = cell_id.split("_").map(Number) as [number, number]
        const neighbour_cell_ids: string[] = []
        for (const dlat of [-1, 0, 1])
        {
            for (const dlon of [-1, 0, 1])
            {
                if (dlat === 0 && dlon === 0) continue
                neighbour_cell_ids.push(`${lat + dlat}_${lon + dlon}`)
            }
        }
        return neighbour_cell_ids
    },
}


/**
 * Uses H3 library at resolution 4
 */
const H3_RESOLUTION = 4

export const latlon_to_from_cell_h3r4: ConvertLatLonToFromCell = {
    round_latlon_to_cell_centre: (latlon) =>
    {
        const [lat, lon] = cellToLatLng(latLngToCell(latlon.lat, latlon.lon, H3_RESOLUTION))
        return { lat, lon }
    },
    latlon_to_cell_id: (latlon) => latLngToCell(latlon.lat, latlon.lon, H3_RESOLUTION),
    cell_id_to_latlon: (cell_id) =>
    {
        const [lat, lon] = cellToLatLng(cell_id)
        return { lat, lon }
    },
    neighbour_cell_ids: (cell_id) => gridDisk(cell_id, 1).filter(neighbour_id => neighbour_id !== cell_id),
}


// TODO IVEA7H_Z7 dggal https://github.com/ecere/dggal/#installation-from-npm


export const latlon_to_from_cell_raw: ConvertLatLonToFromCell = {
    round_latlon_to_cell_centre: (latlon) => latlon,
    latlon_to_cell_id: (latlon) => `${latlon.lat}_${latlon.lon}`,
    cell_id_to_latlon: (cell_id) =>
    {
        const [lat, lon] = cell_id.split("_").map(Number) as [number, number]
        return { lat, lon }
    },
    // Cell size is unknown so neighbours cannot be derived
    neighbour_cell_ids: () => [],
}
