import { expect } from "chai"

import {
    calculate_power_balance_by_cell,
    type CalculatePowerBalanceArgs,
} from "./power_balance.ts"
import type { ILatLon, ElectricalGrid, LatLonToCell } from "./interface.ts"
import { parse_grid_csv_data } from "./parse_data.ts"


// Simple 1 degree cells, e.g. "11,19"
const latlon_to_cell: LatLonToCell = {
    round_to_cell_centre: (latlon: ILatLon) => ({ lat: Math.round(latlon.lat), lon: Math.round(latlon.lon) }),
    to_cell_id: (latlon: ILatLon) => `${Math.round(latlon.lat)},${Math.round(latlon.lon)}`
}

const two_bus_grid: ElectricalGrid = parse_grid_csv_data({
    busses: `bus_id,voltage,lon,lat
0,220,0,0
1,300,1,0
`,
    ac_lines: `line_id,bus0,bus1,voltage,s_nom,x_pu,geometry
0,0,1,400,1000,1e-4,`,
    dc_links: `link_id,bus0,bus1,voltage,p_nom,geometry
`,
})


describe("calculate_power_balance_by_cell", () =>
{
    it("returns an empty balance for an empty grid with no supply or demand", () =>
    {
        const args: CalculatePowerBalanceArgs = {
            electrical_grid: { busses: [], ac_lines: [], dc_links: [] },
            electrical_demand_GW_by_cell: {},
            electrical_supply_GW_by_cell: {},
            latlon_to_cell,
        }

        expect(calculate_power_balance_by_cell(args)).to.deep.equal({})
    })


    it("balances supply and demand across a connected two bus grid", () =>
    {
        const args: CalculatePowerBalanceArgs = {
            electrical_grid: two_bus_grid,
            electrical_demand_GW_by_cell: { "0,0": 0.5 },
            electrical_supply_GW_by_cell: { "0,1": 0.5 },
            latlon_to_cell,
        }

        const balance = calculate_power_balance_by_cell(args)

        // Net balance: supply minus demand, so the generating cell exports and the load cell imports
        expect(balance["0,0"]).to.be.closeTo(-0.5, 1e-6)
        expect(balance["0,1"]).to.be.closeTo(0.5, 1e-6)
    })


    it("limits flow to the capacity of the line", () =>
    {
        const args: CalculatePowerBalanceArgs = {
            electrical_grid: two_bus_grid,
            electrical_demand_GW_by_cell: { "0,0": 2 },
            electrical_supply_GW_by_cell: { "0,1": 2 },
            latlon_to_cell,
        }

        const balance = calculate_power_balance_by_cell(args)

        // Line capacity is 1000 MW = 1 GW so only 1 GW can be delivered
        expect(balance["0,0"]).to.be.closeTo(-1, 1e-6)
        expect(balance["0,1"]).to.be.closeTo(1, 1e-6)
    })
})
