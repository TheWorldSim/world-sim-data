import type { LatLonElectricalGrid } from "./interface.ts"


/** [from_bus_id, to_bus_id, x_pu, capacity_mw (default unlimited)] */
export type TestAcLine = [string, string, number, number?]
/** [from_bus_id, to_bus_id, capacity_mw (default unlimited)] */
export type TestDcLink = [string, string, number?]


/** Busses are named "0", "1", ... and all sit at the same location */
export function create_test_grid(ac_lines: TestAcLine[], dc_links: TestDcLink[] = [], bus_count: number = 3): LatLonElectricalGrid
{
    return {
        buses: Array.from({ length: bus_count }, (_, i) => ({ id: String(i), latlon: { lat: 0, lon: 0 } })),
        ac_lines: ac_lines.map(([from_bus_id, to_bus_id, x_pu, capacity_mw = Infinity], index) =>
            ({ id: `${index}`, from_bus_id, to_bus_id, path: [], capacity_mw, x_pu, voltage_kv: 400 })),
        dc_links: dc_links.map(([from_bus_id, to_bus_id, capacity_mw = Infinity], index) =>
            ({ id: `${index}`, from_bus_id, to_bus_id, path: [], capacity_mw, voltage_kv: 400 })),
    }
}
