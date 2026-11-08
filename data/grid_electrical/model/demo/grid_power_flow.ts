import { calculate_power_balance, type PoweredElectricalGrid } from "../src/power_balance.ts"
import { grid_to_screen } from "./latlon_to_screen.ts"
import { manage_svg_view } from "./manage_svg_view.ts"
import { power_grids } from "./power_grids.ts"
import { make_lines_and_links_layer, make_buses_layer } from "./render_grid_as_svg.ts"


const svg_view = manage_svg_view(document.getElementById("grid-display") as unknown as SVGSVGElement)


function render_grid(): void
{
    const spread = power_grids.get_grid_spread()
    const cell_id_to_latlon = power_grids.get_cell_id_to_latlon()
    const powered_grid = power_grids.get_grid()
    const { cellular_grid: grid } = powered_grid

    const svg_grid_display = svg_view.svg
    svg_grid_display.replaceChildren()

    const { width, height } = svg_grid_display.getBoundingClientRect()
    const { project, home_view } = grid_to_screen({ grid, width, height, spread, cell_id_to_latlon })

    svg_view.set_home_view(home_view)

    function handle_change_cell_MW(cell_id: string, change_MW: number)
    {
        change_MW *= 100

        const demand = powered_grid.demand_MW_by_cell[cell_id] || 0
        const supply = powered_grid.supply_MW_by_cell[cell_id] || 0
        if (change_MW > 0) powered_grid.supply_MW_by_cell[cell_id] = supply + change_MW
        else if (change_MW < 0)
        {
            let remaining = -change_MW
            if (supply > 0)
            {
                // change_MW == -100, remaining (initial) == 100
                // supply == 200, change_supply == 100, remaining == 0
                // supply == 100, change_supply == 100, remaining == 0
                // supply == 80,  change_supply == 80,  remaining == 20
                // supply == 20,  change_supply == 20,  remaining == 80

                const change_supply = Math.min(supply, -change_MW)
                powered_grid.supply_MW_by_cell[cell_id] = supply - change_supply

                remaining -= change_supply
            }
            powered_grid.demand_MW_by_cell[cell_id] = demand + remaining
        }

        update_view()
    }

    const lines = make_lines_and_links_layer(grid, project)
    const buses = make_buses_layer(grid, project, handle_change_cell_MW)

    svg_grid_display.append(lines.svg)
    svg_grid_display.append(buses.svg)

    svg_grid_display.addEventListener("pointerdown", (event: PointerEvent) => {
        const pressed_line = event.target instanceof Element && event.target.closest(".ln-hit") !== null
        if (!pressed_line) lines.clear_pinned_line()
    })

    function update_view()
    {
        const balance = calculate_power_balance(powered_grid)
        buses.update_MW_by_cell(power_grids.get_net_MW_by_cell(), balance.status_by_cell)
        lines.update_MW_by_line(balance.MW_by_line, balance.MW_by_link)
    }
    update_view()
}

render_grid()

document.getElementById("dataset")?.addEventListener("change", async (event) => {
    const target = event.target as HTMLSelectElement
    await power_grids.select_grid(target.value as "3ac_1dc" | "7ac_1dc" | "uk" | "uk_ni" | "europe")
    render_grid()
})

document.getElementById("dgg")?.addEventListener("change", async (event) => {
    const target = event.target as HTMLSelectElement
    await power_grids.set_dgg(target.value as "1dp" | "h3r4")
    render_grid()
})
