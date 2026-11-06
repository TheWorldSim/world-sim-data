const EPSILON = 1e-9
const MAX_ITERATIONS = 20000


/**
 * Tiny dense simplex: maximise objective . x subject to constraints x <= limits, x >= 0.
 * Requires limits >= 0 (negative limits are clamped to 0) so the origin is always feasible
 * and no phase one is needed.  Returns x.
 */
export function simplex_max(objective: number[], constraints: number[][], limits: number[]): number[]
{
    const variable_count = objective.length
    const constraint_count = constraints.length
    const rhs_column = variable_count + constraint_count

    const tableau = build_tableau(objective, constraints, limits)
    const objective_row = constraint_count
    const basis = Array.from({ length: constraint_count }, (_, i) => variable_count + i)

    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++)
    {
        const entering = find_entering_column(tableau[objective_row], rhs_column)
        if (entering < 0) break

        const leaving = find_leaving_row(tableau, basis, entering, constraint_count, rhs_column)
        // Unbounded cannot happen when every variable has an upper bound
        if (leaving < 0) break

        pivot(tableau, leaving, entering)
        basis[leaving] = entering
    }

    const x = new Array<number>(variable_count).fill(0)
    for (let row = 0; row < constraint_count; row++)
    {
        if (basis[row] < variable_count) x[basis[row]] = Math.max(0, tableau[row][rhs_column])
    }
    return x
}


/** One row per constraint (with its slack variable), then the negated objective row */
function build_tableau(objective: number[], constraints: number[][], limits: number[]): number[][]
{
    const variable_count = objective.length
    const constraint_count = constraints.length
    const width = variable_count + constraint_count + 1

    const tableau: number[][] = constraints.map((coefficients, i) =>
    {
        const row = new Array<number>(width).fill(0)
        for (let j = 0; j < variable_count; j++) row[j] = coefficients[j]
        row[variable_count + i] = 1
        row[width - 1] = Math.max(0, limits[i])
        return row
    })

    const objective_row = new Array<number>(width).fill(0)
    for (let j = 0; j < variable_count; j++) objective_row[j] = -objective[j]
    tableau.push(objective_row)

    return tableau
}


/** Bland's rule: lowest-index improving column (avoids cycling) */
function find_entering_column(objective_row: number[], rhs_column: number): number
{
    for (let j = 0; j < rhs_column; j++)
    {
        if (objective_row[j] < -EPSILON) return j
    }
    return -1
}


/** Minimum ratio test, ties broken by the lowest basis variable index */
function find_leaving_row(tableau: number[][], basis: number[], entering: number, constraint_count: number, rhs_column: number): number
{
    let leaving = -1
    let best_ratio = Infinity

    for (let row = 0; row < constraint_count; row++)
    {
        const coefficient = tableau[row][entering]
        if (coefficient <= EPSILON) continue

        const ratio = tableau[row][rhs_column] / coefficient
        const is_smaller = ratio < best_ratio - EPSILON
        const is_tie_with_lower_basis = leaving >= 0
            && Math.abs(ratio - best_ratio) <= EPSILON
            && basis[row] < basis[leaving]

        if (is_smaller || is_tie_with_lower_basis)
        {
            best_ratio = ratio
            leaving = row
        }
    }

    return leaving
}


function pivot(tableau: number[][], pivot_row: number, pivot_column: number): void
{
    const width = tableau[pivot_row].length
    const pivot_value = tableau[pivot_row][pivot_column]
    for (let j = 0; j < width; j++) tableau[pivot_row][j] /= pivot_value

    for (let row = 0; row < tableau.length; row++)
    {
        const factor = tableau[row][pivot_column]
        if (row === pivot_row || factor === 0) continue

        for (let j = 0; j < width; j++) tableau[row][j] -= factor * tableau[pivot_row][j]
    }
}
