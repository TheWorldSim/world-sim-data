import { expect } from "chai"

import { latlon_to_from_cell_1dp, latlon_to_from_cell_h3r4, latlon_to_from_cell_raw } from "./latlon_to_from_cell.ts"


describe("latlon_to_from_cell", () =>
{
    describe("latlon_to_from_cell_1dp", () =>
    {
        it("should give the 8 cells around a cell", () =>
        {
            expect(latlon_to_from_cell_1dp.neighbour_cell_ids("11_19")).to.have.members([
                "10_18", "10_19", "10_20",
                "11_18", "11_20",
                "12_18", "12_19", "12_20",
            ])
        })

        it("should give the neighbours of a cell with negative coordinates", () =>
        {
            expect(latlon_to_from_cell_1dp.neighbour_cell_ids("-1_0")).to.have.members([
                "-2_-1", "-2_0", "-2_1",
                "-1_-1", "-1_1",
                "0_-1", "0_0", "0_1",
            ])
        })
    })

    describe("latlon_to_from_cell_h3r4", () =>
    {
        it("should give the 6 cells around a cell, none of which is the cell itself", () =>
        {
            const cell_id = latlon_to_from_cell_h3r4.latlon_to_cell_id({ lat: 51.5, lon: -0.12 })

            const neighbour_cell_ids = latlon_to_from_cell_h3r4.neighbour_cell_ids(cell_id)

            expect(neighbour_cell_ids).to.have.length(6)
            expect(neighbour_cell_ids).to.not.include(cell_id)
        })

        it("should have the cell as a neighbour of each of its neighbours", () =>
        {
            const cell_id = latlon_to_from_cell_h3r4.latlon_to_cell_id({ lat: 51.5, lon: -0.12 })

            for (const neighbour_cell_id of latlon_to_from_cell_h3r4.neighbour_cell_ids(cell_id))
            {
                expect(latlon_to_from_cell_h3r4.neighbour_cell_ids(neighbour_cell_id)).to.include(cell_id)
            }
        })
    })

    describe("latlon_to_from_cell_raw", () =>
    {
        it("should not know the neighbours of a cell", () =>
        {
            expect(latlon_to_from_cell_raw.neighbour_cell_ids("1.5_2.5")).to.deep.equal([])
        })
    })
})
