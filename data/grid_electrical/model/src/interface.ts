
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
    /** Cells which share an edge or vertex with the given cell, excluding itself */
    neighbour_cell_ids: (cell_id: string) => string[]
}


export interface CommonBus
{
    id: string
}
export interface CommonACLine
{
    id: string
    from_bus_id: string
    to_bus_id: string
    capacity_mw: number
    /** Reactance per unit */
    x_pu: number
    voltage_kv: number
}
export interface CommonDCLink
{
    id: string
    from_bus_id: string
    to_bus_id: string
    capacity_mw: number
    voltage_kv: number
}
/** Virtual buses and lines which carry power from cells without a bus to their nearest bus */
export interface DistributionGrid
{
    /** One virtual bus per cell reached by the distribution grid */
    buses: CommonBus[]
    /** Simplified representation of the distribution network */
    dc_links: CommonDCLink[]
    /** The cell of each virtual bus, in the same order as buses */
    cell_ids: string[]
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

    /** Virtual buses and DC links for cells without a bus */
    distribution_grid: DistributionGrid

    bus_id_to_cell_id: (bus_id: string) => string
}
/** How cells without a bus are connected to the nearest bus through distribution hops */
export interface DistributionGridConfig
{
    /** Capacity in MW of each hop outwards from a bus: the first entry is the hop next to a bus, the second the hop after that, and so on.  Cells further away are not connected. */
    hop_capacity_MW: number[]
}
