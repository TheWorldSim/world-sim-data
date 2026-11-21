import { expect } from "chai"

import type { CellularLynk } from "./interface.ts"
import { lynk_flow_MW } from "./lynk_flow.ts"


describe("lynk_flow_MW", () =>
{
    it("should sum line and link flows, reversing those which are orientated against the lynk", () =>
    {
        const lynk: CellularLynk = {
            lynk_id: 0,
            path_cell_ids: ["a1", "b1"],
            capacity_mw: 5000,
            ac_lines: [{ id: "0", direction: 1 }, { id: "1", direction: -1 }],
            dc_links: [{ id: "0", direction: -1 }],
        }

        const flow_MW = lynk_flow_MW(lynk, { MW_by_line_id: { "0": 10, "1": -20 }, MW_by_link_id: { "0": -30 } })

        expect(flow_MW).equals(60)
    })
})
