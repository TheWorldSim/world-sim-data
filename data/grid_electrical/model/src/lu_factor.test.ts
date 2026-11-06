import { expect } from "chai"

import { lu_factor } from "./lu_factor.ts"


describe("lu_factor", () =>
{
    it("solves a small system", () =>
    {
        // 2x + y = 5, x + 3y = 10  =>  x = 1, y = 3
        const solve = lu_factor([[2, 1], [1, 3]])
        const [x, y] = solve([5, 10])

        expect(x).to.be.closeTo(1, 1e-12)
        expect(y).to.be.closeTo(3, 1e-12)
    })


    it("pivots when the leading entry is zero", () =>
    {
        // y = 2, x = 3
        const solve = lu_factor([[0, 1], [1, 0]])
        const [x, y] = solve([2, 3])

        expect(x).to.be.closeTo(3, 1e-12)
        expect(y).to.be.closeTo(2, 1e-12)
    })


    it("can be reused for several right hand sides", () =>
    {
        const solve = lu_factor([[4, 0], [0, 2]])

        expect(Array.from(solve([4, 2]))).to.deep.equal([1, 1])
        expect(Array.from(solve([8, 6]))).to.deep.equal([2, 3])
    })


    it("throws for a singular matrix", () =>
    {
        expect(() => lu_factor([[1, 2], [2, 4]])).to.throw("Singular system")
    })
})
