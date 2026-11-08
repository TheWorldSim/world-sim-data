export interface ViewBox
{
    x: number
    y: number
    w: number
    h: number
}

export interface SvgView
{
    svg: SVGSVGElement
    /** Sets the fully zoomed-out view. The user can't zoom out or pan beyond it. */
    set_home_view: (view: ViewBox) => void
}

const MAX_ZOOM_IN = 100

function clamp(value: number, min: number, max: number): number
{
    return Math.min(Math.max(value, min), max)
}

export function manage_svg_view(svg: SVGSVGElement): SvgView
{
    let home_view: ViewBox = { x: 0, y: 0, w: 1, h: 1 }

    const current_view = (): ViewBox => {
        const [x, y, w, h] = (svg.getAttribute("viewBox") ?? "0 0 1 1").split(" ").map(Number)
        return { x, y, w, h }
    }

    const set_view = (view: ViewBox) => {
        svg.setAttribute("viewBox", `${view.x} ${view.y} ${view.w} ${view.h}`)
    }

    // Zooming out past the home view snaps to it. Otherwise the view is kept inside the home view.
    const constrain = (view: ViewBox): ViewBox => {
        if (view.w >= home_view.w) return { ...home_view }
        return {
            x: clamp(view.x, home_view.x, home_view.x + home_view.w - view.w),
            y: clamp(view.y, home_view.y, home_view.y + home_view.h - view.h),
            w: view.w,
            h: view.h,
        }
    }

    const to_user_space = (client_x: number, client_y: number) => {
        const point = svg.createSVGPoint()
        point.x = client_x
        point.y = client_y
        return point.matrixTransform(svg.getScreenCTM()!.inverse())
    }

    svg.addEventListener("wheel", (event: WheelEvent) => {
        event.preventDefault()
        const view = current_view()
        const new_w = clamp(view.w * Math.exp(event.deltaY * 0.0015), home_view.w / MAX_ZOOM_IN, home_view.w)
        const ratio = new_w / view.w
        // Keep the point under the cursor fixed while zooming
        const focus = to_user_space(event.clientX, event.clientY)
        set_view(constrain({
            x: focus.x - (focus.x - view.x) * ratio,
            y: focus.y - (focus.y - view.y) * ratio,
            w: new_w,
            h: view.h * ratio,
        }))
    }, { passive: false })

    // Pointer capture is deferred until the pointer moves, because capturing retargets the click to the SVG and stops clicks on child elements
    const DRAG_THRESHOLD_PX = 4
    let drag: { pointer_id: number, client_x: number, client_y: number, view: ViewBox, pixels_per_unit: number, captured: boolean } | null = null
    svg.addEventListener("pointerdown", (event: PointerEvent) => {
        drag = {
            pointer_id: event.pointerId,
            client_x: event.clientX,
            client_y: event.clientY,
            view: current_view(),
            pixels_per_unit: svg.getScreenCTM()!.a,
            captured: false,
        }
    })
    svg.addEventListener("pointermove", (event: PointerEvent) => {
        if (!drag) return
        if (!drag.captured) {
            const moved = Math.hypot(event.clientX - drag.client_x, event.clientY - drag.client_y)
            if (moved < DRAG_THRESHOLD_PX) return
            svg.setPointerCapture(drag.pointer_id)
            drag.captured = true
        }
        set_view(constrain({
            ...drag.view,
            x: drag.view.x - (event.clientX - drag.client_x) / drag.pixels_per_unit,
            y: drag.view.y - (event.clientY - drag.client_y) / drag.pixels_per_unit,
        }))
    })
    const end_drag = () => { drag = null }
    svg.addEventListener("pointerup", end_drag)
    svg.addEventListener("pointercancel", end_drag)

    return {
        svg,
        set_home_view: (view: ViewBox) => {
            home_view = view
            set_view(view)
        },
    }
}
