import { aggregate_grid_to_cells } from "../src/aggregate_grid_to_cells.ts"
import { filter_grid, type GridFilter } from "../src/filter_grid.ts"
import type { ConvertLatLonToFromCell, LatLonElectricalGrid } from "../src/interface.ts"
import { latlon_to_from_cell_1dp, latlon_to_from_cell_h3r4, latlon_to_from_cell_raw } from "../src/latlon_to_from_cell.ts"
import { parse_grid_csv_data } from "../src/parse_data.ts"
import type { PoweredElectricalGrid } from "../src/power_balance.ts"


type DGG = "latlon_raw" |"1dp" | "h3r4"
const dgg_converters: Record<DGG, ConvertLatLonToFromCell> = {
    "latlon_raw": latlon_to_from_cell_raw,
    "1dp": latlon_to_from_cell_1dp,
    "h3r4": latlon_to_from_cell_h3r4,
}

/** Lat/lon grid with supply and demand keyed by bus, so it can be reaggregated to any DGG */
interface SourceGrid
{
    latlon_grid: LatLonElectricalGrid
    supply_MW_by_bus: {[bus_id: string]: number}
    demand_MW_by_bus: {[bus_id: string]: number}
}


const _3ac_1dc_grid: LatLonElectricalGrid = parse_grid_csv_data({
    buses: `
        bus_id,voltage,lon,lat
        0,0,1,2
        1,0,2,2
        2,0,2,1
        3,0,1,1
    `,
    ac_lines: `
        line_id,bus0,bus1,voltage,s_nom,x_pu,geometry
        0,0,1,400,1000,1e-4,
        1,1,2,400,1000,1e-4,
        2,2,3,400,1000,1e-4,
    `,
    dc_links: `
        link_id,bus0,bus1,voltage,p_nom,geometry
        0,0,3,400,100,
    `,
})

const source_3ac_1dc: SourceGrid = {
    latlon_grid: _3ac_1dc_grid,
    supply_MW_by_bus: { "0": 200 },
    demand_MW_by_bus: { "3": 150, "2": 50 },
}


const _7ac_1dc_grid: LatLonElectricalGrid = parse_grid_csv_data({
    buses: `
        bus_id,voltage,lon,lat
        0,0,3,3
        1,0,2,2
        2,0,1,2
        3,0,2,1
        4,0,1,1
        5,0,1.5,0
    `,
    ac_lines: `
        line_id,bus0,bus1,voltage,s_nom,x_pu,geometry
        0,0,1,400,1000,1e-4,
        1,1,2,400,1000,1e-4,
        2,1,3,400,1000,1e-4,
        3,2,4,400,1000,1e-4,
        4,3,4,400,1000,1e-4,
        5,3,5,400,1000,1e-4,
        6,4,5,400,1000,1e-4,
    `,
    dc_links: `
        link_id,bus0,bus1,voltage,p_nom,geometry
        0,0,3,400,1000,
    `,
})

const source_7ac_1dc: SourceGrid = {
    latlon_grid: _7ac_1dc_grid,
    supply_MW_by_bus: { "0": 500 },
    demand_MW_by_bus: { "0": 100, "4": 500 },
}

// The europe grid data is in "../../eur/processed/buses.csv", "../../eur/processed/lines.csv" and "../../eur/processed/links.csv"

let source_europe: SourceGrid | undefined = undefined
async function get_source_europe(): Promise<SourceGrid>
{
    if (source_europe === undefined)
    {
        const europe_grid: LatLonElectricalGrid = parse_grid_csv_data({
            buses: await (await fetch("data_eur/buses.csv")).text(),
            ac_lines: await (await fetch("data_eur/lines.csv")).text(),
            dc_links: await (await fetch("data_eur/links.csv")).text(),
        })

        source_europe = { latlon_grid: europe_grid, supply_MW_by_bus: {}, demand_MW_by_bus: {} }
    }
    return source_europe
}


let source_uk_ie: SourceGrid | undefined = undefined
async function get_source_uk_ie(): Promise<SourceGrid>
{
    if (source_uk_ie === undefined)
    {
        const uk_ie_grid: LatLonElectricalGrid = parse_grid_csv_data({
            buses: await (await fetch("data_eur/buses.csv")).text(),
            ac_lines: await (await fetch("data_eur/lines.csv")).text(),
            dc_links: await (await fetch("data_eur/links.csv")).text(),
        })

        source_uk_ie = { latlon_grid: uk_ie_grid, supply_MW_by_bus: {}, demand_MW_by_bus: {} }
        grid_filter = {
            start_bus_id: "16",  // Somewhere in Kent
            stop_bus_ids: new Set([
                // After the aggregation to h3r4, these are the bus ids
                "236", // Northern France
                "300", // Northern France
                "842", // Belgium
                "2778", // Netherlands
                "351", // Denmark
                "19", // Norway

                // "6173", // Northern France
                // "6220", // Northern France
                // "2932", // Northern France
                // "5724", // Belgium
                // "6615", // Netherlands
                // "2528", // Denmark
                // "38", // Norway
            ])
        }
    }
    return source_uk_ie
}


let source_uk_ni: SourceGrid | undefined = undefined
async function get_source_uk_ni(): Promise<SourceGrid>
{
    if (source_uk_ni === undefined)
    {
        const uk_ie_grid: LatLonElectricalGrid = parse_grid_csv_data({
            buses: await (await fetch("data_eur/buses.csv")).text(),
            ac_lines: await (await fetch("data_eur/lines.csv")).text(),
            dc_links: await (await fetch("data_eur/links.csv")).text(),
        })

        source_uk_ni = { latlon_grid: uk_ie_grid, supply_MW_by_bus: {}, demand_MW_by_bus: {} }
        grid_filter = {
            start_bus_id: "16",  // Somewhere in Kent
            stop_bus_ids: new Set([
                // After the aggregation to h3r4, these are the bus ids
                "4759", // Ireland
                "4663", // Ireland
                "236", // Northern France
                "300", // Northern France
                "842", // Belgium
                "2778", // Netherlands
                "351", // Denmark
                "19", // Norway
            ])
        }
    }
    return source_uk_ni
}


let source_uk: SourceGrid | undefined = undefined
async function get_source_uk(): Promise<SourceGrid>
{
    if (source_uk === undefined)
    {
        const uk_ie_grid: LatLonElectricalGrid = parse_grid_csv_data({
            buses: await (await fetch("data_eur/buses.csv")).text(),
            ac_lines: await (await fetch("data_eur/lines.csv")).text(),
            dc_links: await (await fetch("data_eur/links.csv")).text(),
        })

        source_uk = { latlon_grid: uk_ie_grid, supply_MW_by_bus: {}, demand_MW_by_bus: {} }
        grid_filter = {
            start_bus_id: "16",  // Somewhere in Kent
            stop_bus_ids: new Set([
                // After the aggregation to h3r4, these are the bus ids
                "3134", // NI
                "4663", // Ireland
                "236", // Northern France
                "300", // Northern France
                "842", // Belgium
                "2778", // Netherlands
                "351", // Denmark
                "19", // Norway
            ])
        }
    }
    return source_uk
}


/** Aggregates the source grid to cells, mapping supply and demand from buses to cells */
function build_powered_grid(source: SourceGrid, dgg: DGG, grid_filter: GridFilter | undefined): PoweredElectricalGrid
{
    let cellular_grid = aggregate_grid_to_cells(source.latlon_grid, dgg_converters[dgg])
    if (grid_filter !== undefined)
    {
        cellular_grid = filter_grid(cellular_grid, grid_filter)
    }

    return {
        cellular_grid,
        supply_MW_by_cell: bus_MW_to_cell_MW(source.supply_MW_by_bus, cellular_grid),
        demand_MW_by_cell: bus_MW_to_cell_MW(source.demand_MW_by_bus, cellular_grid),
    }
}

// Several buses can share a cell after aggregation, so their MW are summed
function bus_MW_to_cell_MW(MW_by_bus: {[bus_id: string]: number}, cellular_grid: PoweredElectricalGrid["cellular_grid"]): {[cell_id: string]: number}
{
    const MW_by_cell: {[cell_id: string]: number} = {}
    for (const [bus_id, MW] of Object.entries(MW_by_bus))
    {
        const cell_id = cellular_grid.bus_id_to_cell_id(bus_id)
        MW_by_cell[cell_id] = (MW_by_cell[cell_id] ?? 0) + MW
    }
    return MW_by_cell
}

// Cached per source and DGG so that supply and demand edits persist while the same grid and DGG are selected
const powered_grid_cache = new Map<SourceGrid, Partial<Record<DGG, PoweredElectricalGrid>>>()
function get_powered_grid(source: SourceGrid, dgg: DGG, grid_filter: GridFilter | undefined): PoweredElectricalGrid
{
    let powered_by_dgg = powered_grid_cache.get(source)
    if (powered_by_dgg === undefined)
    {
        powered_by_dgg = {}
        powered_grid_cache.set(source, powered_by_dgg)
    }

    const existing = powered_by_dgg[dgg]
    if (existing !== undefined) return existing

    const built = build_powered_grid(source, dgg, grid_filter)
    powered_by_dgg[dgg] = built
    return built
}


let selected_source: SourceGrid = source_3ac_1dc
let selected_dgg: DGG = "1dp"
let grid_filter: GridFilter | undefined = undefined

const selected: { grid: PoweredElectricalGrid, spread: number } = {
    grid: get_powered_grid(selected_source, selected_dgg, grid_filter),
    spread: 1.5,
}

function update_selected_grid()
{
    selected.grid = get_powered_grid(selected_source, selected_dgg, grid_filter)
}

export const power_grids = {
    select_grid: async (grid_name: "3ac_1dc" | "7ac_1dc" | "uk" | "uk_ni" | "uk_ie" | "europe") =>
    {
        selected.spread = 1.5

        if (grid_name === "3ac_1dc") selected_source = source_3ac_1dc
        else if (grid_name === "7ac_1dc") selected_source = source_7ac_1dc
        else if (grid_name === "uk")
        {
            selected_source = await get_source_uk()
            selected.spread = 20
        }
        else if (grid_name === "uk_ni")
        {
            selected_source = await get_source_uk_ni()
            selected.spread = 20
        }
        else if (grid_name === "uk_ie")
        {
            selected_source = await get_source_uk_ie()
            selected.spread = 20
        }
        else if (grid_name === "europe")
        {
            selected_source = await get_source_europe()
            selected.spread = 40
        }
        else return

        update_selected_grid()
    },
    get_grid: (): PoweredElectricalGrid =>
    {
        return selected.grid
    },
    get_grid_spread: () =>
    {
        return selected.spread
    },
    get_net_MW_by_cell: () =>
    {
        return Array.from(new Set(Object.keys(selected.grid.demand_MW_by_cell).concat(Object.keys(selected.grid.supply_MW_by_cell))))
            .reduce((acc, cell_id) =>
            {
                const net = (selected.grid.supply_MW_by_cell[cell_id] || 0) - (selected.grid.demand_MW_by_cell[cell_id] || 0)
                acc[cell_id] = net
                return acc
            }, {} as Record<string, number>)
    },
    get_cell_id_to_latlon: () => dgg_converters[selected_dgg].cell_id_to_latlon,
    set_dgg: async (dgg: DGG) =>
    {
        selected_dgg = dgg
        update_selected_grid()
    }
}
