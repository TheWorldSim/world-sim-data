
export interface ILatLon
{
    lat: number
    lon: number
}


export interface LatLonToCell
{
    round_to_cell_centre: (latlon: ILatLon) => ILatLon
    to_cell_id: (latlon: ILatLon) => string
}


export interface Bus
{
    id: string
    latlon: ILatLon
}
export interface ACLine
{
    from_bus_id: string
    to_bus_id: string
    path: ILatLon[]
    capacity_mw: number
    /** Reactance per unit */
    x_pu: number
    voltage_kv: number
}
export interface DCLink
{
    from_bus_id: string
    to_bus_id: string
    path: ILatLon[]
    capacity_mw: number
    voltage_kv: number
}
export interface ElectricalGrid
{
    busses: Bus[]
    ac_lines: ACLine[]
    dc_links: DCLink[]
}
