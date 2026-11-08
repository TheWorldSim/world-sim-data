import type { CellularBus, CellularElectricalGrid } from "../src/interface.ts"
import { flow_level } from "../src/flow_level.ts"
import type { CellStatus } from "../src/power_balance.ts"
import type { ProjectCellId } from "./latlon_to_screen.ts"


const SVG_NS = "http://www.w3.org/2000/svg"
function make_svg_element(tag: string, attributes: Record<string, string | number>, class_name?: string): SVGElement
{
    const element = document.createElementNS(SVG_NS, tag)
    for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, String(value))
    if (class_name) element.setAttribute("class", class_name)
    return element
}


export function make_lines_and_links_layer(grid: CellularElectricalGrid, project: ProjectCellId)
{
    const lines_layer = make_svg_element("g", {}, "lines")

    interface LineSvg
    {
        points: Point[]
        capacity_MW: number
        flow_MW: number
        label_position: Point
        base: SVGElement
        flow: SVGElement
        arrow: SVGElement
        hit: SVGElement
    }
    const ac_line_svg_by_id: Record<string, LineSvg> = {}
    const dc_link_svg_by_id: Record<string, LineSvg> = {}

    // A pinned line (pressed) takes precedence over the hovered line. Hover only applies to mouse / trackpad.
    let hovered_line: LineSvg | null = null
    let pinned_line: LineSvg | null = null
    // After unpinning with a mouse the pointer is still over the line, so the label stays hidden until it leaves
    let hover_suppressed = false

    const label_group = make_svg_element("g", { visibility: "hidden" }, "line-label")
    const label_MW = make_svg_element("text", { y: -3 }, "lab-v halo")
    const label_percent = make_svg_element("text", { y: 11 }, "lab-n halo")
    label_group.append(label_MW, label_percent)

    function add_line(line: { id: string, capacity_mw: number, path_cell_ids: string[] }, kind: "ac" | "dc", line_svg_by_id: Record<string, LineSvg>)
    {
        const points = line.path_cell_ids.map(cell_id => project(cell_id))
        const base = make_svg_element("path", {}, `ln ${kind}`)
        const flow = make_svg_element("path", { visibility: "hidden" }, "ln-flow")
        const arrow = make_svg_element("path", { d: "M -6 -6 L 8 0 L -6 6 L -2 0 Z", visibility: "hidden" }, "arrow")
        const hit = make_svg_element("path", {}, "ln-hit")
        const group = make_svg_element("g", {})
        group.append(base, flow, arrow, hit)
        lines_layer.append(group)

        const label_position = label_position_along_path(points)
        const line_svg: LineSvg = { points, capacity_MW: line.capacity_mw, flow_MW: 0, label_position, base, flow, arrow, hit }
        line_svg_by_id[line.id] = line_svg
        update_line_svg(line_svg, 0, 1)

        hit.addEventListener("pointerenter", (event: PointerEvent) => {
            if (event.pointerType !== "mouse") return
            hovered_line = line_svg
            hover_suppressed = false
            refresh_label()
        })
        hit.addEventListener("pointerleave", (event: PointerEvent) => {
            if (event.pointerType !== "mouse") return
            if (hovered_line === line_svg) hovered_line = null
            hover_suppressed = false
            refresh_label()
        })
        hit.addEventListener("pointerdown", (event: PointerEvent) => {
            if (pinned_line === line_svg)
            {
                pinned_line = null
                hover_suppressed = event.pointerType === "mouse"
            }
            else pinned_line = line_svg
            refresh_label()
        })
    }

    grid.ac_lines.forEach(line => add_line(line, "ac", ac_line_svg_by_id))
    grid.dc_links.forEach(link => add_line(link, "dc", dc_link_svg_by_id))

    const reference_capacity_MW = Math.max(100, ...grid.ac_lines.map(line => line.capacity_mw), ...grid.dc_links.map(link => link.capacity_mw))

    /** Positive flow goes from the first to the last point of the path, negative flow the reverse */
    function update_line_svg(line_svg: LineSvg, flow_MW: number, reference_MW: number)
    {
        const magnitude_MW = Math.abs(flow_MW)
        const level = flow_level(flow_MW, line_svg.capacity_MW)
        const is_moving = level !== "idle"

        const points = flow_MW >= 0 ? line_svg.points : line_svg.points.slice().reverse()
        const d = points.map(({ x, y }, i) => `${i ? "L" : "M"}${x} ${y}`).join(" ")
        line_svg.base.setAttribute("d", d)
        line_svg.flow.setAttribute("d", d)
        line_svg.hit.setAttribute("d", d)
        line_svg.flow_MW = flow_MW

        line_svg.base.style.strokeWidth = `${is_moving ? 5 + 5 * Math.min(1, magnitude_MW / reference_MW) : 3}px`
        line_svg.base.style.stroke = is_moving ? `var(--flow-${level})` : "var(--idle)"

        const visibility = is_moving ? "visible" : "hidden"
        line_svg.flow.setAttribute("visibility", visibility)
        line_svg.flow.style.animationDuration = `${Math.max(0.45, 1.6 - magnitude_MW / 120).toFixed(2)}s`

        line_svg.arrow.setAttribute("visibility", visibility)
        const { x, y, angle_degrees } = point_along_path(points, 0.5)
        line_svg.arrow.setAttribute("transform", `translate(${x.toFixed(1)},${y.toFixed(1)}) rotate(${angle_degrees.toFixed(1)})`)
    }

    function update_MW_by_line(MW_by_line: {[line_id: string]: number}, MW_by_link: {[link_id: string]: number})
    {
        for (const [id, line_svg] of Object.entries(ac_line_svg_by_id))
        {
            update_line_svg(line_svg, MW_by_line[id] ?? 0, reference_capacity_MW)
        }
        for (const [id, line_svg] of Object.entries(dc_link_svg_by_id))
        {
            update_line_svg(line_svg, MW_by_link[id] ?? 0, reference_capacity_MW)
        }
        refresh_label()
    }

    function refresh_label()
    {
        const shown = pinned_line ?? (hover_suppressed ? null : hovered_line)
        if (!shown)
        {
            label_group.setAttribute("visibility", "hidden")
            return
        }

        const magnitude_MW = Math.abs(shown.flow_MW)
        label_group.setAttribute("transform", `translate(${shown.label_position.x.toFixed(1)},${shown.label_position.y.toFixed(1)})`)
        label_MW.textContent = `${Math.round(magnitude_MW)} MW / ${Math.round(shown.capacity_MW)} MW`
        label_percent.textContent = shown.capacity_MW > 0 ? `${Math.round(100 * magnitude_MW / shown.capacity_MW)}%` : "–"
        label_group.setAttribute("visibility", "visible")
    }

    function clear_pinned_line()
    {
        pinned_line = null
        refresh_label()
    }

    lines_layer.append(label_group)
    return { svg: lines_layer, update_MW_by_line, clear_pinned_line }
}


type Point = { x: number, y: number }

/** Position, and direction of travel, a fraction of the way along a path */
function point_along_path(points: Point[], fraction: number): { x: number, y: number, angle_degrees: number }
{
    const lengths = points.slice(1).map((p, i) => Math.hypot(p.x - points[i].x, p.y - points[i].y))
    let remaining = fraction * lengths.reduce((total, length) => total + length, 0)

    for (let i = 0; i < lengths.length; ++i)
    {
        if (remaining > lengths[i] && i < lengths.length - 1)
        {
            remaining -= lengths[i]
            continue
        }

        const from = points[i], to = points[i + 1]
        const t = lengths[i] > 0 ? Math.min(remaining / lengths[i], 1) : 0
        return {
            x: from.x + (to.x - from.x) * t,
            y: from.y + (to.y - from.y) * t,
            angle_degrees: Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI,
        }
    }

    const { x, y } = points[0] ?? { x: 0, y: 0 }
    return { x, y, angle_degrees: 0 }
}


function label_position_along_path(points: Point[]): Point
{
    const { x, y, angle_degrees } = point_along_path(points, 0.5)

    const distance_offset = 30
    const angle_radians = angle_degrees * Math.PI / 180
    const offset_x = distance_offset * Math.sin(angle_radians)
    const offset_y = distance_offset * Math.cos(angle_radians)

    return {
        x: x + offset_x,
        y: y + offset_y,
    }
}


export function make_buses_layer(grid: CellularElectricalGrid, project: ProjectCellId, change_MW_by_cell: (cell_id: string, MW: number) => void)
{
    const buses_layer = make_svg_element("g", {}, "buses")

    interface BusSvg
    {
        bus: CellularBus
        group: SVGElement
        amount_label: SVGElement
    }
    const bus_svg_by_cell_id: Record<string, BusSvg> = {}

    function update_label(bus_svg: BusSvg, MW?: number)
    {
        bus_svg.amount_label.textContent = (MW ? `${MW}` : "")
    }

    // The inner disc shows supply (src) or demand (sink / unmet), the ring shows why supply was curtailed
    const status_classes: Record<CellStatus, string[]> = {
        idle: [],
        supplying: ["src"],
        supply_curtailed_by_demand: ["src", "curtailed-demand"],
        supply_curtailed_by_grid: ["src", "curtailed-grid"],
        demand_met: ["sink"],
        demand_unmet: ["unmet"],
    }
    const all_status_classes = Array.from(new Set(Object.values(status_classes).flat()))

    function update_status(bus_svg: BusSvg, status: CellStatus)
    {
        bus_svg.group.classList.remove(...all_status_classes)
        bus_svg.group.classList.add(...status_classes[status])
    }

    for (const bus of grid.buses)
    {
        const { x, y } = project(bus.cell_id)
        const bus_group = make_svg_element("g", { transform: `translate(${x} ${y})` }, "bus")
        const bus_name = make_svg_element("text", { y: -2 }, "bus-name")
        bus_name.textContent = bus.id
        const bus_amount_label = make_svg_element("text", { y: 16 }, "bus-amt")
        bus_amount_label.textContent = ""

        // >1</text><text class="bus-amt" y="16">+100</text>
        bus_group.append(
            make_svg_element("circle", { r: 36 }, "ring"),
            make_svg_element("circle", { r: 30 }, "disc"),
            bus_name,
            bus_amount_label,
        )
        buses_layer.append(bus_group)

        bus_group.addEventListener("click", (e) =>
        {
            change_MW_by_cell(bus.cell_id, 1)
        })
        bus_group.addEventListener("contextmenu", (event: MouseEvent) => {
            event.preventDefault()
            change_MW_by_cell(bus.cell_id, -1)
        })

        const bus_svg: BusSvg = { bus, group: bus_group, amount_label: bus_amount_label }
        bus_svg_by_cell_id[bus.cell_id] = bus_svg
        update_label(bus_svg)
    }


    function update_MW_by_cell(MW_by_cell: {[cell_id: string]: number}, status_by_cell: {[cell_id: string]: CellStatus})
    {
        for (const [cell_id, bus_svg] of Object.entries(bus_svg_by_cell_id))
        {
            update_label(bus_svg, MW_by_cell[cell_id])
            update_status(bus_svg, status_by_cell[cell_id] ?? "idle")
        }
    }

    return { svg: buses_layer, update_MW_by_cell }
}
