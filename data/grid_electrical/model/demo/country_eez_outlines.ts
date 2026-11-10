import type { ILatLon } from "../src/interface.ts"


export interface EEZOutline
{
    name: string
    /** Each polygon's outer ring is followed by its holes, so the fill rule must be evenodd */
    rings: ILatLon[][]
}

const UK_EEZ_URL = "data_boundaries/eez/uk_eez.geojson"

export async function load_uk_eez(): Promise<EEZOutline>
{
    const reponse = await fetch(UK_EEZ_URL)
    const result = await (reponse).json()
    const eezs = result.features as GeoJSON.Feature[]

    const outline: EEZOutline[] = []
    for (const eez of eezs)
    {
        const name: string = eez.properties?.name || "uk_eez"

        const { geometry } = eez
        if (geometry.type !== "Polygon") continue

        const rings = geometry.coordinates.map(ring => (ring as [number, number][]).map(([lon, lat]): ILatLon => ({ lat, lon })))
        outline.push({ name, rings })
    }
    return outline[0]!
}
