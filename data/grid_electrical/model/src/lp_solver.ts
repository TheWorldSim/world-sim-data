import load_highs_module, { type Highs } from "highs"


// The package typings describe a CommonJS default export but, as an ES module import, it is the loader function itself
const load_highs = load_highs_module as unknown as () => Promise<Highs>

// Loading the WASM solver is asynchronous but solving is synchronous, so load it once up front
const highs = await load_highs()


/** One decision variable: lower <= x <= upper, contributing objective * x to the objective. Use +/-Infinity for no bound. */
export interface LpVariable
{
    lower: number
    upper: number
    objective: number
}

/** [variable index, coefficient] */
export type LpTerm = [number, number]

/** lower <= sum(coefficient * variable) <= upper.  Use lower === upper for an equality. */
export interface LpConstraint
{
    lower: number
    upper: number
    /** Each variable may appear at most once */
    terms: LpTerm[]
}

export interface LinearProgram
{
    variables: LpVariable[]
    constraints: LpConstraint[]
}


/** Returns the optimal value of every variable.  Throws if the program is not solvable to optimality. */
export function maximise(program: LinearProgram): number[]
{
    if (program.variables.length === 0) return []

    return highs.withModel(to_highs_model(program), model =>
    {
        model.options.set("output_flag", false)
        model.run()

        const status = model.getModelStatus()
        if (status !== highs.constants.modelStatus.optimal)
        {
            throw new Error(`Linear program was not solved to optimality, HiGHS model status: ${status}`)
        }

        return Array.from(model.getSolution().colValue)
    })
}


function to_highs_model(program: LinearProgram)
{
    const { variables, constraints } = program

    // Constraint matrix in compressed sparse row form
    const starts = new Int32Array(constraints.length + 1)
    constraints.forEach((constraint, i) => { starts[i + 1] = starts[i] + constraint.terms.length })
    const indices = new Int32Array(starts[constraints.length])
    const values = new Float64Array(starts[constraints.length])
    constraints.forEach((constraint, i) =>
    {
        constraint.terms.forEach(([variable, coefficient], k) =>
        {
            indices[starts[i] + k] = variable
            values[starts[i] + k] = coefficient
        })
    })

    return {
        numCols: variables.length,
        numRows: constraints.length,
        sense: highs.constants.objectiveSense.maximize,
        colCost: variables.map(variable => variable.objective),
        colLower: variables.map(variable => variable.lower),
        colUpper: variables.map(variable => variable.upper),
        rowLower: constraints.map(constraint => constraint.lower),
        rowUpper: constraints.map(constraint => constraint.upper),
        matrix: {
            format: "csr" as const,
            numRows: constraints.length,
            numCols: variables.length,
            starts,
            indices,
            values,
        },
    }
}
