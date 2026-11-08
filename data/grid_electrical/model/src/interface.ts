
export interface ILatLon
{
    lat: number
    lon: number
}


export interface ConvertLatLonToFromCell
{
    round_latlon_to_cell_centre: (latlon: ILatLon) => ILatLon
    latlon_to_cell_id: (latlon: ILatLon) => string
    cell_id_to_latlon: (cell_id: string) => ILatLon
}


interface CommonBus
{
    id: string
}
interface CommonACLine
{
    id: string
    from_bus_id: string
    to_bus_id: string
    capacity_mw: number
    /** Reactance per unit */
    x_pu: number
    voltage_kv: number
}
interface CommonDCLink
{
    id: string
    from_bus_id: string
    to_bus_id: string
    capacity_mw: number
    voltage_kv: number
}
export interface CommonElectricalGrid
{
    buses: CommonBus[]
    ac_lines: CommonACLine[]
    dc_links: CommonDCLink[]
}


export interface LatLonBus extends CommonBus
{
    latlon: ILatLon
}
export interface LatLonACLine extends CommonACLine
{
    path_latlon: ILatLon[]
}
export interface LatLonDCLink extends CommonDCLink
{
    path_latlon: ILatLon[]
}
export interface LatLonElectricalGrid extends CommonElectricalGrid
{
    buses: LatLonBus[]
    ac_lines: LatLonACLine[]
    dc_links: LatLonDCLink[]
}


export interface CellularBus extends CommonBus
{
    cell_id: string
}
export interface CellularACLine extends CommonACLine
{
    path_cell_ids: string[]
}
export interface CellularDCLink extends CommonDCLink
{
    path_cell_ids: string[]
}
export interface CellularElectricalGrid extends CommonElectricalGrid
{
    buses: CellularBus[]
    ac_lines: CellularACLine[]
    dc_links: CellularDCLink[]

    bus_id_to_cell_id: (bus_id: string) => string
}
