import { expect } from "chai"

import { flow_level } from "./flow_level.ts"


describe("flow_level", () =>
{
    it("is idle for negligible flow in either direction", () =>
    {
        expect(flow_level(0, 1000)).to.equal("idle")
        expect(flow_level(-0.01, 1000)).to.equal("idle")
    })


    it("is low below 70% of capacity, regardless of direction", () =>
    {
        expect(flow_level(100, 1000)).to.equal("low")
        expect(flow_level(-699, 1000)).to.equal("low")
    })


    it("is mid from 70% up to but excluding 100% of capacity", () =>
    {
        expect(flow_level(700, 1000)).to.equal("mid")
        expect(flow_level(-999, 1000)).to.equal("mid")
    })


    it("is max at, or beyond, capacity", () =>
    {
        expect(flow_level(1000, 1000)).to.equal("max")
        expect(flow_level(-1000, 1000)).to.equal("max")
        expect(flow_level(999.9999999, 1000)).to.equal("max")
        expect(flow_level(5, 0)).to.equal("max")
    })
})
