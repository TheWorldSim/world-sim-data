import { cellToLatLng, latLngToCell } from "h3-js"

import type { ConvertLatLonToFromCell } from "./interface.ts"


/**
 * Simple 1 degree cells, e.g. "11,19"
 */
export const latlon_to_from_cell_1dp: ConvertLatLonToFromCell = {
    round_latlon_to_cell_centre: (latlon) => ({ lat: Math.round(latlon.lat), lon: Math.round(latlon.lon) }),
    latlon_to_cell_id: (latlon) => `${Math.round(latlon.lat)}_${Math.round(latlon.lon)}`,
    cell_id_to_latlon: (cell_id) =>
    {
        const [lat, lon] = cell_id.split("_").map(Number)
        return { lat, lon }
    }
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
    }
}


// TODO IVEA7H_Z7 dggal https://github.com/ecere/dggal/#installation-from-npm


export const latlon_to_from_cell_raw: ConvertLatLonToFromCell = {
    round_latlon_to_cell_centre: (latlon) => latlon,
    latlon_to_cell_id: (latlon) => `${latlon.lat}_${latlon.lon}`,
    cell_id_to_latlon: (cell_id) =>
    {
        const [lat, lon] = cell_id.split("_").map(Number)
        return { lat, lon }
    }
}
