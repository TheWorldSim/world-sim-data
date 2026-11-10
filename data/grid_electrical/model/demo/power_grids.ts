import { aggregate_grid_to_cells } from "../src/aggregate_grid_to_cells.ts"
import type { CellularElectricalGrid, ConvertLatLonToFromCell, LatLonElectricalGrid } from "../src/interface.ts"
import { latlon_to_from_cell_1dp, latlon_to_from_cell_h3r4, latlon_to_from_cell_raw } from "../src/latlon_to_from_cell.ts"
import { parse_latlon_grid_csv_data } from "../src/parse_data.ts"
import type { PoweredCellularElectricalGrid, PoweredLatLonElectricalGrid } from "../src/power_balance.ts"


type DGG = "latlon_raw" | "1dp" | "h3r4"
const dgg_converters: Record<DGG, ConvertLatLonToFromCell> = {
    "latlon_raw": latlon_to_from_cell_raw,
    "1dp": latlon_to_from_cell_1dp,
    "h3r4": latlon_to_from_cell_h3r4,
}


interface PoweredGridWithConfig extends PoweredLatLonElectricalGrid
{
    name: string
    spread: number
    modify_grid?: (cellular_grid: CellularElectricalGrid) => CellularElectricalGrid
}

const _3ac_1dc_grid: LatLonElectricalGrid = parse_latlon_grid_csv_data({
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

const source_3ac_1dc: PoweredGridWithConfig = {
    name: "3ac 1dc",
    latlon_grid: _3ac_1dc_grid,
    demand_MW_by_bus_id: { "3": 150, "2": 50 },
    supply_MW_by_bus_id: { "0": 200 },
    spread: 1.5,
}


const _7ac_1dc_grid: LatLonElectricalGrid = parse_latlon_grid_csv_data({
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

const source_7ac_1dc: PoweredGridWithConfig = {
    name: "7ac 1dc",
    latlon_grid: _7ac_1dc_grid,
    supply_MW_by_bus_id: { "0": 500 },
    demand_MW_by_bus_id: { "0": 100, "4": 500 },
    spread: 1.5,
}



function modify_grid(cellular_grid: CellularElectricalGrid)
{
    // A fudge to map cells in France, Belgium and the Netherlands
    // to be on land instead of in the sea.
    const cell_ids_map: Record<string, string> = {
        "8419481ffffffff": "841948bffffffff",
        "84194ddffffffff": "84194d1ffffffff",
        "84196b1ffffffff": "84196bbffffffff",
    }

    function change_cell_id(cell_id: string): string
    {
        return cell_ids_map[cell_id] || cell_id
    }

    cellular_grid.buses.forEach(bus => {
        bus.cell_id = change_cell_id(bus.cell_id)
    })
    cellular_grid.ac_lines.forEach(line => {
        line.path_cell_ids = line.path_cell_ids.map(change_cell_id)
    })
    cellular_grid.dc_links.forEach(link => {
        link.path_cell_ids = link.path_cell_ids.map(change_cell_id)
    })

    return cellular_grid
}


// The europe grid data is in "../../processed/eur/buses.csv", "../../processed/eur/lines.csv" and "../../processed/eur/links.csv"
let source_europe: PoweredGridWithConfig | undefined = undefined
async function get_source_europe(): Promise<PoweredGridWithConfig>
{
    if (source_europe === undefined)
    {
        const europe_grid: LatLonElectricalGrid = parse_latlon_grid_csv_data({
            buses: await (await fetch("data_grids/eur/buses.csv")).text(),
            ac_lines: await (await fetch("data_grids/eur/lines.csv")).text(),
            dc_links: await (await fetch("data_grids/eur/links.csv")).text(),
        })

        source_europe = {
            name: "europe",
            spread: 40,
            latlon_grid: europe_grid,
            supply_MW_by_bus_id: {},
            demand_MW_by_bus_id: {},
            modify_grid,
        }
    }
    return source_europe
}


let source_uk: PoweredGridWithConfig | undefined = undefined
async function get_source_uk(): Promise<PoweredGridWithConfig>
{
    if (source_uk === undefined)
    {
        const uk_grid: LatLonElectricalGrid = parse_latlon_grid_csv_data({
            buses: await (await fetch("data_grids/uk/buses.csv")).text(),
            ac_lines: await (await fetch("data_grids/uk/lines.csv")).text(),
            dc_links: await (await fetch("data_grids/uk/links.csv")).text(),
        })

        source_uk = {
            name: "UK",
            spread: 20,
            latlon_grid: uk_grid,
            supply_MW_by_bus_id: {},
            demand_MW_by_bus_id: {},
            modify_grid,
        }
    }
    return source_uk
}


// Cached per source and DGG so that supply and demand edits persist while the same grid and DGG are selected
const powered_grid_cache = new Map<string, Partial<Record<DGG, PoweredCellularElectricalGrid>>>()
function get_powered_grid(source: PoweredGridWithConfig, dgg: DGG): PoweredCellularElectricalGrid
{
    let powered_by_dgg = powered_grid_cache.get(source.name)
    if (powered_by_dgg === undefined)
    {
        powered_by_dgg = {}
        powered_grid_cache.set(source.name, powered_by_dgg)
    }

    const existing = powered_by_dgg[dgg]
    if (existing !== undefined) return existing

    let cellular_grid = aggregate_grid_to_cells(source.latlon_grid, dgg_converters[dgg])
    cellular_grid = source.modify_grid?.(cellular_grid) || cellular_grid

    powered_by_dgg[dgg] = {
        cellular_grid,
        supply_MW_by_cell_id: bus_MW_to_cell_MW(source.supply_MW_by_bus_id, cellular_grid),
        demand_MW_by_cell_id: bus_MW_to_cell_MW(source.demand_MW_by_bus_id, cellular_grid),
    }

    return powered_by_dgg[dgg]
}

// Several buses can share a cell after aggregation, so their MW are summed
function bus_MW_to_cell_MW(MW_by_bus: {[bus_id: string]: number}, cellular_grid: PoweredCellularElectricalGrid["cellular_grid"]): {[cell_id: string]: number}
{
    const MW_by_cell: {[cell_id: string]: number} = {}
    for (const [bus_id, MW] of Object.entries(MW_by_bus))
    {
        const cell_id = cellular_grid.bus_id_to_cell_id(bus_id)
        MW_by_cell[cell_id] = (MW_by_cell[cell_id] ?? 0) + MW
    }
    return MW_by_cell
}


let selected_dgg: DGG = "1dp"
let selected_grid_and_config: PoweredGridWithConfig = source_3ac_1dc


export const power_grids = {
    select_grid: async (grid_name: "3ac_1dc" | "7ac_1dc" | "uk" | "europe") =>
    {
        if (grid_name === "3ac_1dc") selected_grid_and_config = source_3ac_1dc
        else if (grid_name === "7ac_1dc") selected_grid_and_config = source_7ac_1dc
        else if (grid_name === "uk") selected_grid_and_config = await get_source_uk()
        else if (grid_name === "europe") selected_grid_and_config = await get_source_europe()
        else return
    },
    get_grid: (): PoweredCellularElectricalGrid =>
    {
        return get_powered_grid(selected_grid_and_config, selected_dgg)
    },
    get_grid_spread: () =>
    {
        return selected_grid_and_config.spread
    },
    get_net_MW_by_cell: () =>
    {
        const grid: PoweredCellularElectricalGrid = get_powered_grid(selected_grid_and_config, selected_dgg)
        return get_net_MW_by_cell(grid)
    },
    get_cell_id_to_latlon: () => dgg_converters[selected_dgg].cell_id_to_latlon,
    set_dgg: (dgg: DGG) =>
    {
        selected_dgg = dgg
    }
}


function get_net_MW_by_cell(grid: PoweredCellularElectricalGrid)
{
    return Array.from(new Set(Object.keys(grid.demand_MW_by_cell_id).concat(Object.keys(grid.supply_MW_by_cell_id))))
        .reduce((acc, cell_id) =>
        {
            const net = (grid.supply_MW_by_cell_id[cell_id] || 0) - (grid.demand_MW_by_cell_id[cell_id] || 0)
            acc[cell_id] = net
            return acc
        }, {} as Record<string, number>)
}
