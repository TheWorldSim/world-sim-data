import { aggregate_grid_to_cells } from "../src/aggregate_grid_to_cells.ts"
import type { LatLonElectricalGrid } from "../src/interface.ts"
import { latlon_to_from_cell } from "../src/latlon_to_from_cell.ts"
import { parse_grid_csv_data } from "../src/parse_data.ts"
import type { PoweredElectricalGrid } from "../src/power_balance.ts"

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

const cellular_3ac_1dc_grid = aggregate_grid_to_cells(_3ac_1dc_grid, latlon_to_from_cell)

const powered_3ac_1dc_grid: PoweredElectricalGrid = {
    cellular_grid: cellular_3ac_1dc_grid,
    supply_MW_by_cell: {
        [cellular_3ac_1dc_grid.bus_id_to_cell_id("0")]: 200,
    },
    demand_MW_by_cell: {
        [cellular_3ac_1dc_grid.bus_id_to_cell_id("3")]: 150,
        [cellular_3ac_1dc_grid.bus_id_to_cell_id("2")]: 50,
    },
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

const cellular_7ac_1dc_grid = aggregate_grid_to_cells(_7ac_1dc_grid, latlon_to_from_cell)

const powered_7ac_1dc_grid: PoweredElectricalGrid = {
    cellular_grid: cellular_7ac_1dc_grid,
    demand_MW_by_cell: {
        [cellular_7ac_1dc_grid.bus_id_to_cell_id("0")]: 100,
        [cellular_7ac_1dc_grid.bus_id_to_cell_id("4")]: 500,
    },
    supply_MW_by_cell: {
        [cellular_7ac_1dc_grid.bus_id_to_cell_id("0")]: 500,
    },
}

// The europe grid data is in "../../eur/processed/buses.csv", "../../eur/processed/lines.csv" and "../../eur/processed/links.csv"

let powered_europe_grid: PoweredElectricalGrid | undefined = undefined
async function set_powered_europe_grid()
{
    if (powered_europe_grid === undefined)
    {
        const europe_grid: LatLonElectricalGrid = parse_grid_csv_data({
            buses: await (await fetch("data_eur/buses.csv")).text(),
            ac_lines: await (await fetch("data_eur/lines.csv")).text(),
            dc_links: await (await fetch("data_eur/links.csv")).text(),
        })

        const cellular_europe_grid = aggregate_grid_to_cells(europe_grid, latlon_to_from_cell)

        powered_europe_grid = {
            cellular_grid: cellular_europe_grid,
            supply_MW_by_cell: {},
            demand_MW_by_cell: {},
        }
    }
    selected.grid = powered_europe_grid
    selected.spread = 40
}


const selected: { grid: PoweredElectricalGrid, spread: number } = {
    grid: powered_3ac_1dc_grid,
    spread: 1.5,
}
export const power_grids = {
    select_grid: async (grid_name: "3ac_1dc" | "7ac_1dc" | "uk" | "uk_ni" | "europe") =>
    {
        selected.spread = 1.5

        if (grid_name === "3ac_1dc") selected.grid = powered_3ac_1dc_grid
        else if (grid_name === "7ac_1dc") selected.grid = powered_7ac_1dc_grid
        // else if (grid_name === "uk") selected.grid = powered_3ac_1dc_grid
        // else if (grid_name === "uk_ni") selected.grid = powered_3ac_1dc_grid
        else if (grid_name === "europe") await set_powered_europe_grid()
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
}
