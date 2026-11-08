export interface Edge
{
    from_bus_index: number
    to_bus_index: number
    is_dc: boolean
}


export interface AcSpanningForest
{
    /** Which synchronous (AC connected) area each bus belongs to */
    component_of_bus: number[]
    /** The root bus of each area */
    reference_buses: number[]
    parent_bus: number[]
    parent_line: number[]
    depth: number[]
    tree_lines: Set<number>
}

/** One line of a cycle, and whether the cycle runs along it (+1, from_bus to to_bus) or against it (-1) */
export interface CycleStep
{
    line: number
    direction: 1 | -1
}


/** Breadth first spanning forest of the AC subgraph, one tree per synchronous area. DC lines are ignored. */
export function find_ac_spanning_forest(bus_count: number, edges: Edge[]): AcSpanningForest
{
    const neighbours: { bus_index: number, edge_index: number }[][] = Array.from({ length: bus_count }, () => [])
    edges.forEach((edge, edge_index) =>
    {
        if (edge.is_dc) return
        neighbours[edge.from_bus_index].push({ bus_index: edge.to_bus_index, edge_index })
        neighbours[edge.to_bus_index].push({ bus_index: edge.from_bus_index, edge_index })
    })

    const forest: AcSpanningForest = {
        component_of_bus: new Array<number>(bus_count).fill(-1),
        reference_buses: [],
        parent_bus: new Array<number>(bus_count).fill(-1),
        parent_line: new Array<number>(bus_count).fill(-1),
        depth: new Array<number>(bus_count).fill(0),
        tree_lines: new Set<number>(),
    }

    for (let start = 0; start < bus_count; ++start)
    {
        if (forest.component_of_bus[start] >= 0) continue

        const component = forest.reference_buses.length
        forest.reference_buses.push(start)
        forest.component_of_bus[start] = component

        const queue = [start]
        for (let head = 0; head < queue.length; ++head)
        {
            const bus = queue[head]
            for (const neighbour of neighbours[bus])
            {
                if (forest.component_of_bus[neighbour.bus_index] >= 0) continue

                forest.component_of_bus[neighbour.bus_index] = component
                forest.parent_bus[neighbour.bus_index] = bus
                forest.parent_line[neighbour.bus_index] = neighbour.edge_index
                forest.depth[neighbour.bus_index] = forest.depth[bus] + 1
                forest.tree_lines.add(neighbour.edge_index)
                queue.push(neighbour.bus_index)
            }
        }
    }

    return forest
}


/**
 * Fundamental cycles: each AC line outside the spanning forest plus the tree path between its ends.
 * Kirchhoff's voltage law says the reactance weighted flow around each of these cycles sums to zero.
 * Each cycle starts with its closing line, then the tree lines back from its to_bus up to the common
 * ancestor, then down to its from_bus.
 */
export function build_fundamental_cycles(lines: Edge[], forest: AcSpanningForest): CycleStep[][]
{
    const cycles: CycleStep[][] = []

    lines.forEach((line, l) =>
    {
        if (line.is_dc || forest.tree_lines.has(l)) return

        // from_bus -> to_bus along the line, then back from to_bus to from_bus through the tree
        const cycle: CycleStep[] = [{ line: l, direction: 1 }]
        const going_up: CycleStep[] = []
        const going_down: CycleStep[] = []

        let up_bus = line.to_bus_index
        let down_bus = line.from_bus_index
        while (up_bus !== down_bus)
        {
            if (forest.depth[up_bus] >= forest.depth[down_bus])
            {
                going_up.push(create_step(lines, forest.parent_line[up_bus], up_bus))
                up_bus = forest.parent_bus[up_bus]
            }
            else
            {
                going_down.push(create_step(lines, forest.parent_line[down_bus], forest.parent_bus[down_bus]))
                down_bus = forest.parent_bus[down_bus]
            }
        }

        cycles.push([...cycle, ...going_up, ...going_down.reverse()])
    })

    return cycles
}


function create_step(lines: Edge[], line: number, travelling_from_bus: number): CycleStep
{
    return { line, direction: lines[line].from_bus_index === travelling_from_bus ? 1 : -1 }
}
