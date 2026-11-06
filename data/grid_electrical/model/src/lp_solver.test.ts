import { expect } from "chai"

import { maximise } from "./lp_solver.ts"


describe("maximise", () =>
{
    it("maximises a small linear program", () =>
    {
        // max 3x + 2y  s.t.  x + y <= 4,  x + 3y <= 6,  0 <= x <= 3,  y >= 0
        const [x, y] = maximise({
            variables: [
                { lower: 0, upper: 3, objective: 3 },
                { lower: 0, upper: Infinity, objective: 2 },
            ],
            constraints: [
                { lower: -Infinity, upper: 4, terms: [[0, 1], [1, 1]] },
                { lower: -Infinity, upper: 6, terms: [[0, 1], [1, 3]] },
            ],
        })

        expect(x).to.be.closeTo(3, 1e-9)
        expect(y).to.be.closeTo(1, 1e-9)
    })


    it("supports free variables and equality constraints", () =>
    {
        // max x  s.t.  x - y = 0,  y <= 5,  x free
        const [x, y] = maximise({
            variables: [
                { lower: -Infinity, upper: Infinity, objective: 1 },
                { lower: -Infinity, upper: 5, objective: 0 },
            ],
            constraints: [
                { lower: 0, upper: 0, terms: [[0, 1], [1, -1]] },
            ],
        })

        expect(x).to.be.closeTo(5, 1e-9)
        expect(y).to.be.closeTo(5, 1e-9)
    })


    it("returns no values for a program with no variables", () =>
    {
        expect(maximise({ variables: [], constraints: [] })).to.deep.equal([])
    })


    it("throws when the program is unbounded", () =>
    {
        expect(() => maximise({
            variables: [{ lower: 0, upper: Infinity, objective: 1 }],
            constraints: [],
        })).to.throw("not solved to optimality")
    })
})
