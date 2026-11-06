import { expect } from "chai"

import { simplex_max } from "./simplex.ts"


describe("simplex_max", () =>
{
    it("maximises a small linear program", () =>
    {
        // max 3x + 2y  s.t.  x + y <= 4,  x + 3y <= 6,  x <= 3
        const [x, y] = simplex_max(
            [3, 2],
            [[1, 1], [1, 3], [1, 0]],
            [4, 6, 3],
        )

        expect(x).to.be.closeTo(3, 1e-9)
        expect(y).to.be.closeTo(1, 1e-9)
    })


    it("returns zeros when no variable improves the objective", () =>
    {
        expect(simplex_max([-1, 0], [[1, 1]], [5])).to.deep.equal([0, 0])
    })


    it("respects a single upper bound", () =>
    {
        expect(simplex_max([1], [[1]], [7])).to.deep.equal([7])
    })
})
