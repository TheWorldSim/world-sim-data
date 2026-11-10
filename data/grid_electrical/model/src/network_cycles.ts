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
    parent_bus_index: number[]
    parent_line_or_link_index: number[]
    depth: number[]
    tree_lines: Set<number>
}

/** One line of a cycle, and whether the cycle runs along it (+1, from_bus to to_bus) or against it (-1) */
export interface CycleStep
{
    line_or_link_index: number
    direction: 1 | -1
}


/** Breadth first spanning forest of the AC subgraph, one tree per synchronous area. DC lines are ignored. */
export function find_ac_spanning_forest(bus_count: number, edges: Edge[]): AcSpanningForest
{
    const neighbours: { bus_index: number, edge_index: number }[][] = Array.from({ length: bus_count }, () => [])
    edges.forEach((edge, edge_index) =>
    {
        if (edge.is_dc) return
        neighbours[edge.from_bus_index]!.push({ bus_index: edge.to_bus_index, edge_index })
        neighbours[edge.to_bus_index]!.push({ bus_index: edge.from_bus_index, edge_index })
    })

    const forest: AcSpanningForest = {
        component_of_bus: new Array<number>(bus_count).fill(-1),
        reference_buses: [],
        parent_bus_index: new Array<number>(bus_count).fill(-1),
        parent_line_or_link_index: new Array<number>(bus_count).fill(-1),
        depth: new Array<number>(bus_count).fill(0),
        tree_lines: new Set<number>(),
    }

    for (let start = 0; start < bus_count; ++start)
    {
        if (forest.component_of_bus[start]! >= 0) continue

        const component = forest.reference_buses.length
        forest.reference_buses.push(start)
        forest.component_of_bus[start] = component

        const queue = [start]
        for (let head = 0; head < queue.length; ++head)
        {
            const bus_index = queue[head]!
            for (const neighbour of neighbours[bus_index]!)
            {
                if (forest.component_of_bus[neighbour.bus_index]! >= 0) continue

                forest.component_of_bus[neighbour.bus_index] = component
                forest.parent_bus_index[neighbour.bus_index] = bus_index
                forest.parent_line_or_link_index[neighbour.bus_index] = neighbour.edge_index
                forest.depth[neighbour.bus_index] = forest.depth[bus_index]! + 1
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
export function build_fundamental_cycles(lines_and_links: Edge[], forest: AcSpanningForest): CycleStep[][]
{
    const cycles: CycleStep[][] = []

    lines_and_links.forEach((line_or_link, line_or_link_index) =>
    {
        if (line_or_link.is_dc || forest.tree_lines.has(line_or_link_index)) return

        // from_bus -> to_bus along the line, then back from to_bus to from_bus through the tree
        const cycle: CycleStep[] = [{ line_or_link_index, direction: 1 }]
        const going_up: CycleStep[] = []
        const going_down: CycleStep[] = []

        let up_bus_index = line_or_link.to_bus_index
        let down_bus_index = line_or_link.from_bus_index
        while (up_bus_index !== down_bus_index)
        {
            if (forest.depth[up_bus_index]! >= forest.depth[down_bus_index]!)
            {
                going_up.push(create_step(lines_and_links, forest.parent_line_or_link_index[up_bus_index]!, up_bus_index))
                up_bus_index = forest.parent_bus_index[up_bus_index]!
            }
            else
            {
                going_down.push(create_step(lines_and_links, forest.parent_line_or_link_index[down_bus_index]!, forest.parent_bus_index[down_bus_index]!))
                down_bus_index = forest.parent_bus_index[down_bus_index]!
            }
        }

        cycles.push([...cycle, ...going_up, ...going_down.reverse()])
    })

    return cycles
}


function create_step(lines: Edge[], line_or_link_index: number, travelling_from_bus: number): CycleStep
{
    return { line_or_link_index, direction: lines[line_or_link_index]!.from_bus_index === travelling_from_bus ? 1 : -1 }
}
