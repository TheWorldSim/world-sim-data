import fs = require("fs")

import {
    ATTRIBUTES,
    PARENT_ATTRIBUTE,
    ATTRIBUTE,
    VALUE_REF,
    SIMPLE_VALUE_REF,
    FILE_VALUE_REF,
    VALUES,
    COLUMNS,
    DERIVED_VALUE_REF,
    COLUMNS_REFERENCE,
} from "./schema"


function process_data <U extends ATTRIBUTES> (data: U): U
{
    //console.log("process_data data: " + JSON.stringify(data).slice(0, 50))
    const processed_data: U = {} as any

    Object.keys(data).forEach(key => 
    {
        const object = data[key]

        let processed_object: typeof object = {} as any

        //console.log(`process_data object for key ${key}: `)// + JSON.stringify(object).slice(0, 50))

        let processed = false

        const instances = (object as PARENT_ATTRIBUTE).instances
        const attributes = (object as PARENT_ATTRIBUTE).attributes

        if (instances)
        {
            const processed_instances = process_data(instances!)
            ;(processed_object as PARENT_ATTRIBUTE).instances = processed_instances
            processed = true
        }
        
        if (attributes)
        {
            const processed_attributes = process_data(attributes)
            ;(processed_object as PARENT_ATTRIBUTE).attributes = processed_attributes
            processed = true
        }
        else
        {
            const value_refs = (object as ATTRIBUTE).value_refs
                        
            if (value_refs)
            {
                const processed_value_refs = value_refs.map(process_value_ref)
                ;(processed_object as ATTRIBUTE).value_refs = processed_value_refs
                processed = true
            }
            else if (!processed)
            {
                throw new Error("object not processed and does not have `attributes` or `value_refs`: " + JSON.stringify(object))
            }
        }

        (processed_data as any)[key] = processed_object
    })

    return processed_data
}


function process_value_ref (value_ref: VALUE_REF): VALUE_REF
{
    let simple_value_ref: SIMPLE_VALUE_REF = {
        ...value_ref as SIMPLE_VALUE_REF
    }

    if ((value_ref as FILE_VALUE_REF).value_file && (value_ref as FILE_VALUE_REF).bundles.includes("main"))
    {
        simple_value_ref.values = values_from_file_value_ref(value_ref as FILE_VALUE_REF)
    }

    if ((value_ref as DERIVED_VALUE_REF).calculation)
    {
        // TODO: calculate values and columns based on calculation
        simple_value_ref.values = (value_ref as DERIVED_VALUE_REF)._manual_values;
        simple_value_ref.columns = (value_ref as DERIVED_VALUE_REF)._manual_columns;
    }

    // validate_values(simple_value_ref)

    simple_value_ref = flatten_values(simple_value_ref)

    return simple_value_ref
}


function values_from_file_value_ref (value_ref: FILE_VALUE_REF): VALUES
{
    const file_name = value_ref.value_file
    return values_from_file(file_name, value_ref)
}

function values_from_file (file_name: string, value_ref: VALUE_REF): VALUES
{
    return value_strings_from_file(file_name, value_ref)
        .map(line => line.map(parseFloat))
}

function value_strings_from_file (file_name: string, value_ref: VALUE_REF): string[][]
{
    const contents = fs.readFileSync("./data/" + file_name).toString()
    let lines = contents.split("\n")

    if (value_ref.columns)
    {
        lines = lines.slice(1)
    }

    return lines.map(line => line.trim().split(","))
}


// // TODO move this out and into the validate-data-container script?
// function validate_values (value_ref: SIMPLE_VALUE_REF)
// {
//     const column_number = expected_column_number(value_ref.columns, value_ref);

//     value_ref.values.forEach(line_values => {
//         // Will want to do something more advanced later based on value_ref.columns
//         if (line_values.length !== column_number)
//         {
//             console.log("line_values", line_values)
//             // console.log("value_ref", value_ref)
//             throw new Error(`Expected ${column_number} columns but got: ${line_values.length}`);
//         }
//     })
// }


// function expected_column_number (columns: COLUMNS, value_ref: VALUE_REF): number
// {
//     let expected_count = 0

//     const complex_columns = columns.filter(column => typeof column !== "string")
//     expected_count += (columns.length - complex_columns.length)

//     complex_columns.forEach(column => {
//         const filename = (column as COLUMNS_REFERENCE).values_file
//         const values = values_from_file(filename, value_ref)
//         // We take number of rows instead of columns (i.e. not values[0].length)
//         // because these rows are used as column headers
//         expected_count += values.length
//     })

//     return expected_count
// }


function flatten_values (value_ref: SIMPLE_VALUE_REF): SIMPLE_VALUE_REF
{
    if(!value_ref.values) return value_ref

    const processed_values = value_ref.values.reduce((accum, line_values) => accum.concat(line_values), [])

    const processed_value_ref: SIMPLE_VALUE_REF = {
        ...value_ref,
        values: processed_values as any
    }

    return processed_value_ref
}


export {
    process_data,
    value_strings_from_file,
}
