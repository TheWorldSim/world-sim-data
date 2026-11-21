import * as h3 from "h3-js"

import { aggregate_lynks_by_path } from "../src/aggregate_lynks_by_path.ts"
import { change_cell_MW } from "../src/cell_MW.ts"
import type { CellularLynk } from "../src/interface.ts"
import { calculate_power_balance } from "../src/power_balance.ts"
import { load_europe_country_outlines, type CountryOutline } from "./country_outlines.ts"
import { grid_to_screen } from "./latlon_to_screen.ts"
import { manage_svg_view } from "./manage_svg_view.ts"
import { power_grids } from "./power_grids.ts"
import { make_buses_layer, make_countries_layer, make_h3r4_cells_layer, make_lynks_layer } from "./render_grid_as_svg.ts"


const svg_view = manage_svg_view(document.getElementById("grid-display") as unknown as SVGSVGElement)

let country_outlines: CountryOutline[] = []


async function render_grid(): Promise<void>
{
    const spread = power_grids.get_grid_spread()
    const cell_id_to_latlon = power_grids.get_cell_id_to_latlon()
    const powered_grid = await power_grids.get_grid()
    const { cellular_grid: grid } = powered_grid

    const lynks = aggregate_lynks_by_path(grid)
    show_lynk_capacity_distribution(lynks)

    const svg_grid_display = svg_view.svg
    svg_grid_display.replaceChildren()

    const { width, height } = svg_grid_display.getBoundingClientRect()
    const { project, project_latlon_to_xy, home_view } = grid_to_screen({ grid, width, height, spread, cell_id_to_latlon })

    svg_view.set_home_view(home_view)

    async function update_view()
    {
        const power_balance = calculate_power_balance(powered_grid)
        buses.update_MW_by_cell(await power_grids.get_net_MW_by_cell(), power_balance.status_by_cell_id)
        lynks_layer.update_MW_by_lynk(power_balance)
    }

    function handle_change_cell_MW(cell_id: string, change_MW: number)
    {
        change_cell_MW(powered_grid, cell_id, change_MW * 500)
        update_view()
    }

    const lynks_layer = make_lynks_layer(lynks, project)
    const buses = make_buses_layer(grid, project, handle_change_cell_MW)
    const countries = make_countries_layer(country_outlines, project_latlon_to_xy)
    // Bus cell IDs are only H3 indices when the H3 resolution 4 DGG is selected
    const h3r4_cells = make_h3r4_cells_layer(get_uk_cell_ids(), project_latlon_to_xy)

    svg_grid_display.append(countries)
    svg_grid_display.append(h3r4_cells)
    svg_grid_display.append(lynks_layer.svg)
    svg_grid_display.append(buses.svg)

    svg_grid_display.addEventListener("pointerdown", (event: PointerEvent) => {
        const pressed_lynk = event.target instanceof Element && event.target.closest(".lynk-hit") !== null
        if (!pressed_lynk) lynks_layer.clear_pinned_lynk()
    })

    update_view()
}

document.getElementById("dataset")?.addEventListener("change", async (event) => {
    const target = event.target as HTMLSelectElement
    await power_grids.select_grid(target.value as "3ac_1dc" | "7ac_1dc" | "uk" | "debug" | "europe")
    render_grid()
})

document.getElementById("dgg")?.addEventListener("change", async (event) => {
    const target = event.target as HTMLSelectElement
    await power_grids.set_dgg(target.value as "latlon_raw" | "1dp" | "h3r4")
    render_grid()
})


async function initial_render()
{
    country_outlines = await load_europe_country_outlines().catch((error) => {
        console.error("Failed to load country outlines", error)
        return []
    })
    document.getElementById("dataset")?.dispatchEvent(new Event("change"))
    document.getElementById("dgg")?.dispatchEvent(new Event("change"))
}
initial_render()


function get_uk_cell_ids(): string[]
{
    const h3r3_cell_ids = [
        "82190ffffffffff",
        "821977fffffffff",
        "821957fffffffff",
        "821827fffffffff",
        "82182ffffffffff",
        "82195ffffffffff",
        "821877fffffffff",
        "82194ffffffffff",
        "821947fffffffff",
        "82196ffffffffff",
        "821f37fffffffff",
        "820997fffffffff",
        "821967fffffffff",
        "8209b7fffffffff",
        "820987fffffffff",
        "8209a7fffffffff",
        "82192ffffffffff",
        "821907fffffffff",
    ]
    const h3r4_cell_ids = h3r3_cell_ids.map(h3r3 => h3.cellToChildren(h3r3, 4)).flat()
    return h3r4_cell_ids
}


function show_lynk_capacity_distribution(lynks: CellularLynk[])
{
    let min_capacity = Infinity
    let max_capacity = -Infinity
    for (const lynk of lynks)
    {
        if (lynk.capacity_mw < min_capacity) min_capacity = lynk.capacity_mw
        if (lynk.capacity_mw > max_capacity) max_capacity = lynk.capacity_mw
    }

    const capacity_mw_distribution: { from_mw: number, to_mw: number, lynk_ids: number[] }[] = []

    for (const lynk of lynks)
    {
        const bin_index = Math.floor(lynk.capacity_mw / 1e3)
        if (!capacity_mw_distribution[bin_index]) capacity_mw_distribution[bin_index] = { from_mw: bin_index * 1e3, to_mw: (bin_index + 1) * 1e3, lynk_ids: [] }
        capacity_mw_distribution[bin_index].lynk_ids.push(lynk.lynk_id)
    }
    // Fill in any empty bins between the minimum and maximum capacity
    const min_bin_index = Math.floor(min_capacity / 1e3)
    const max_bin_index = Math.floor(max_capacity / 1e3)
    for (let i = min_bin_index; i <= max_bin_index; ++i)
    {
        if (!capacity_mw_distribution[i]) capacity_mw_distribution[i] = { from_mw: i * 1e3, to_mw: (i + 1) * 1e3, lynk_ids: [] }
    }

    const lynk_capacity_list = document.getElementById("lynk-capacity-list")
    if (!lynk_capacity_list) return
    lynk_capacity_list.innerHTML = ""
    for (const group of capacity_mw_distribution)
    {
        const dt = document.createElement("dt")
        dt.textContent = `${group.from_mw / 1e3} to <${group.to_mw / 1e3} GW: ${group.lynk_ids.length} lynks`
        lynk_capacity_list.appendChild(dt)
    }
}
