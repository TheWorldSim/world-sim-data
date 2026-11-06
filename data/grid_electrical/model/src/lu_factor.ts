const SINGULAR_TOLERANCE = 1e-12


/**
 * LU factorisation (with partial pivoting) of a dense square matrix.
 * Factor once, then solve for as many right hand sides as needed.
 */
export function lu_factor(matrix: number[][]): (rhs: ArrayLike<number>) => Float64Array
{
    const n = matrix.length
    const lu = new Float64Array(n * n)
    const permutation = new Int32Array(n)

    for (let i = 0; i < n; i++)
    {
        permutation[i] = i
        for (let j = 0; j < n; j++) lu[i * n + j] = matrix[i][j]
    }

    for (let column = 0; column < n; column++)
    {
        const pivot_row = find_pivot_row(lu, n, column)
        if (Math.abs(lu[pivot_row * n + column]) < SINGULAR_TOLERANCE) throw new Error("Singular system")

        if (pivot_row !== column) swap_rows(lu, permutation, n, column, pivot_row)
        eliminate_below_pivot(lu, n, column)
    }

    return rhs => lu_solve(lu, permutation, n, rhs)
}


function find_pivot_row(lu: Float64Array, n: number, column: number): number
{
    let pivot_row = column
    for (let row = column + 1; row < n; row++)
    {
        if (Math.abs(lu[row * n + column]) > Math.abs(lu[pivot_row * n + column])) pivot_row = row
    }
    return pivot_row
}


function swap_rows(lu: Float64Array, permutation: Int32Array, n: number, row_a: number, row_b: number): void
{
    for (let j = 0; j < n; j++)
    {
        const temp = lu[row_a * n + j]
        lu[row_a * n + j] = lu[row_b * n + j]
        lu[row_b * n + j] = temp
    }
    const temp = permutation[row_a]
    permutation[row_a] = permutation[row_b]
    permutation[row_b] = temp
}


/** Stores the multipliers in the lower triangle, leaving U in the upper triangle */
function eliminate_below_pivot(lu: Float64Array, n: number, column: number): void
{
    const pivot = lu[column * n + column]

    for (let row = column + 1; row < n; row++)
    {
        const multiplier = lu[row * n + column] / pivot
        lu[row * n + column] = multiplier
        if (multiplier === 0) continue

        for (let j = column + 1; j < n; j++) lu[row * n + j] -= multiplier * lu[column * n + j]
    }
}


function lu_solve(lu: Float64Array, permutation: Int32Array, n: number, rhs: ArrayLike<number>): Float64Array
{
    const x = new Float64Array(n)

    // Forward substitution (L has a unit diagonal)
    for (let i = 0; i < n; i++)
    {
        let sum = rhs[permutation[i]]
        for (let j = 0; j < i; j++) sum -= lu[i * n + j] * x[j]
        x[i] = sum
    }

    // Back substitution
    for (let i = n - 1; i >= 0; i--)
    {
        let sum = x[i]
        for (let j = i + 1; j < n; j++) sum -= lu[i * n + j] * x[j]
        x[i] = sum / lu[i * n + i]
    }

    return x
}
