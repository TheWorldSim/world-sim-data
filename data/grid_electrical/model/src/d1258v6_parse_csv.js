// Copied from https://wikisim.org/wiki/1258v6
import { d1257v3_parse_number_from_string } from "./d1257v3_parse_number_from_string.js"

export const d1258v6_parse_csv = (csv_data, options = {}) =>
{
    // Set option default values
    const {
        delimiter = ",",
        parse_numbers = true,
        trim_fields = true,
    } = options
    let { ignore_rows = 0 } = options

    let rows = []
    let row = []
    let field = ""
    let in_quotes = false
    let i = -1

    csv_data = csv_data.trim()

    while (i < (csv_data.length - 1))
    {
        i++

        const char = csv_data[i]

        if (in_quotes)
        {
            if (char === '"')
            {
                if (csv_data[i + 1] === '"')
                {
                    field += '"'
                    i++
                }
                else in_quotes = false
            } else field += char
            continue
        }

        if (char === '"')
        {
            in_quotes = true
        }
        else if (char === delimiter)
        {
            row.push(field)
            field = ""
        }
        else if (char === "\r" && csv_data[i + 1] === "\n")
        {
            row.push(field)

            if (ignore_rows > 0) --ignore_rows
            else rows.push(row)

            row = []
            field = ""
            i++
        }
        else if (char === "\n" || char === "\r")
        {
            row.push(field)

            if (ignore_rows > 0) --ignore_rows
            else rows.push(row)

            row = []
            field = ""
        } else field += char
    }

    // Add last field/row if needed
    if (field.length > 0 || row.length > 0)
    {
        row.push(field)
        if (ignore_rows > 0) --ignore_rows
        else rows.push(row)
    }

    if (trim_fields)
    {
        rows = rows.map(row => row.map(field =>
        {
            return field.trim()
        }))
    }

    if (parse_numbers)
    {
        rows = rows.map(row => row.map(field =>
        {
            return d1257v3_parse_number_from_string(field)
        }))
    }

    return rows
}
