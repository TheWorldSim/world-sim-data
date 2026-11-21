export type FlowLevel = "idle" | "low" | "mid" | "max"

const IDLE_MW = 0.05
const MID_RATIO = 0.7
const NEGLIGIBLE_MW = 1e-6


/**
 * How heavily loaded a line is: "low" below 70% of its capacity, "mid" below 100%, "max" at 100%
 * (or above, as a line with no capacity carrying any flow is at its limit).  Negligible flow is "idle".
 */
export function flow_level(flow_MW: number, capacity_MW: number): FlowLevel
{
    const magnitude_MW = Math.abs(flow_MW)
    if (magnitude_MW < IDLE_MW) return "idle"

    if (magnitude_MW >= capacity_MW - NEGLIGIBLE_MW) return "max"
    return (magnitude_MW / capacity_MW < MID_RATIO) ? "low" : "mid"
}
