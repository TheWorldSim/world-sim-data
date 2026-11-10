import { feature } from "topojson-client"
import type { ILatLon } from "../src/interface.ts"


export interface CountryOutline
{
    name: string
    /** Each polygon's outer ring is followed by its holes, so the fill rule must be evenodd */
    rings: ILatLon[][]
}

// Stops at Ukraine and Finland, so Russia is not plotted
const europe_country_names = new Set([
    "Albania", "Andorra", "Austria", "Belarus", "Belgium", "Bosnia and Herz.", "Bulgaria", "Croatia", "Czechia",
    "Denmark", "Estonia", "Faeroe Is.", "Finland", "France", "Germany", "Greece", "Guernsey", "Hungary", "Iceland",
    "Ireland", "Isle of Man", "Italy", "Jersey", "Kosovo", "Latvia", "Liechtenstein", "Lithuania", "Luxembourg",
    "Macedonia", "Malta", "Moldova", "Monaco", "Montenegro", "Netherlands", "Norway", "Poland", "Portugal", "Romania",
    "San Marino", "Serbia", "Slovakia", "Slovenia", "Spain", "Sweden", "Switzerland", "Ukraine", "United Kingdom",
    "Vatican", "Åland",
])

const COUNTRIES_URL = "data_boundaries/countries/countries_50m.json"

export async function load_europe_country_outlines(): Promise<CountryOutline[]>
{
    const topology: Parameters<typeof feature>[0] = await (await fetch(COUNTRIES_URL)).json()
    const result = feature(topology, topology.objects["countries"]!)
    const countries = "features" in result ? result.features : [result]

    const outlines: CountryOutline[] = []
    for (const country of countries)
    {
        const name: string = country.properties?.name
        if (!europe_country_names.has(name)) continue

        const { geometry } = country
        if (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon") continue
        const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates

        const rings = polygons.flat().map(ring => (ring as [number, number][]).map(([lon, lat]): ILatLon => ({ lat, lon })))
        outlines.push({ name, rings })
    }
    return outlines
}
