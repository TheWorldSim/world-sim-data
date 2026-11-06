export interface LineEnds
{
    from_bus: number
    to_bus: number
    is_dc: boolean
}


export interface AcSpanningForest
{
    /** Which synchronous (AC connected) area each bus belongs to */
    component_of_bus: number[]
    /** The root bus of each area, used as that area's reference bus */
    reference_buses: number[]
    parent_bus: number[]
    parent_line: number[]
    depth: number[]
    tree_lines: Set<number>
}


/** incidence[bus][line] is +1 where the line starts, -1 where it ends */
export function build_incidence_matrix(bus_count: number, lines: LineEnds[]): number[][]
{
    const incidence = Array.from({ length: bus_count }, () => new Array<number>(lines.length).fill(0))
    lines.forEach((line, l) =>
    {
        incidence[line.from_bus][l] = 1
        incidence[line.to_bus][l] = -1
    })
    return incidence
}


/** Breadth first spanning forest of the AC subgraph, one tree per synchronous area. DC lines are ignored. */
export function find_ac_spanning_forest(bus_count: number, lines: LineEnds[]): AcSpanningForest
{
    const neighbours: { bus: number, line: number }[][] = Array.from({ length: bus_count }, () => [])
    lines.forEach((line, l) =>
    {
        if (line.is_dc) return
        neighbours[line.from_bus].push({ bus: line.to_bus, line: l })
        neighbours[line.to_bus].push({ bus: line.from_bus, line: l })
    })

    const forest: AcSpanningForest = {
        component_of_bus: new Array<number>(bus_count).fill(-1),
        reference_buses: [],
        parent_bus: new Array<number>(bus_count).fill(-1),
        parent_line: new Array<number>(bus_count).fill(-1),
        depth: new Array<number>(bus_count).fill(0),
        tree_lines: new Set<number>(),
    }

    for (let start = 0; start < bus_count; start++)
    {
        if (forest.component_of_bus[start] >= 0) continue

        const component = forest.reference_buses.length
        forest.reference_buses.push(start)
        forest.component_of_bus[start] = component

        const queue = [start]
        for (let head = 0; head < queue.length; head++)
        {
            const bus = queue[head]
            for (const neighbour of neighbours[bus])
            {
                if (forest.component_of_bus[neighbour.bus] >= 0) continue

                forest.component_of_bus[neighbour.bus] = component
                forest.parent_bus[neighbour.bus] = bus
                forest.parent_line[neighbour.bus] = neighbour.line
                forest.depth[neighbour.bus] = forest.depth[bus] + 1
                forest.tree_lines.add(neighbour.line)
                queue.push(neighbour.bus)
            }
        }
    }

    return forest
}


/**
 * Fundamental cycles: each AC line outside the spanning forest plus the tree path between its ends.
 * cycles[cycle][line] is +1 where the cycle runs along a line from its start to its end, -1 against it.
 */
export function build_fundamental_cycles(lines: LineEnds[], forest: AcSpanningForest): number[][]
{
    const cycles: number[][] = []

    lines.forEach((line, l) =>
    {
        if (line.is_dc || forest.tree_lines.has(l)) return

        const cycle = new Array<number>(lines.length).fill(0)
        cycle[l] = 1 // from_bus -> to_bus along the line, then back from to_bus to from_bus through the tree

        let up_bus = line.to_bus
        let down_bus = line.from_bus
        const climbed_from: number[] = []
        const descended_to: number[] = []
        while (up_bus !== down_bus)
        {
            if (forest.depth[up_bus] >= forest.depth[down_bus])
            {
                climbed_from.push(up_bus)
                up_bus = forest.parent_bus[up_bus]
            }
            else
            {
                descended_to.push(down_bus)
                down_bus = forest.parent_bus[down_bus]
            }
        }

        climbed_from.forEach(bus => set_direction(cycle, lines, forest.parent_line[bus], bus))
        descended_to.forEach(bus => set_direction(cycle, lines, forest.parent_line[bus], forest.parent_bus[bus]))
        cycles.push(cycle)
    })

    return cycles
}


function set_direction(cycle: number[], lines: LineEnds[], line_index: number, travelling_from_bus: number): void
{
    cycle[line_index] = lines[line_index].from_bus === travelling_from_bus ? 1 : -1
}
