
export interface SCHEMA {
    schema_version: "0.6"
    data: ATTRIBUTES
    units: {[unit_type: string]: UNIT}
    data_sets: DATA_SET_CONFIG[]
}

export interface DATA_SET_CONFIG {
    name: string
    draft_version: string
    release_version: string
    versions: string[]
}

export type ATTRIBUTES = {[attribute_name: string]: ATTRIBUTE | PARENT_ATTRIBUTE }
export interface PARENT_ATTRIBUTE {
    instances?: ATTRIBUTES
    attributes: ATTRIBUTES
}

export interface ATTRIBUTE {
    value_refs: VALUE_REF[]
    labels?: string[]
    description?: string
}

export type VALUE_REF = SIMPLE_VALUE_REF | DERIVED_VALUE_REF | REFERENCE_VALUE_REF

export type SIMPLE_VALUE_REF = {
    values: VALUES
} & COMMON_VALUE_DEF

export type REFERENCE_VALUE_REF = {
    value_file: string
} & COMMON_VALUE_DEF

interface COMMON_VALUE_DEF {
    columns: COLUMNS
    meta_data: {
        units: {[key: string]: string}
        params: {[key: string]: number | string}
    }
    created: string
    reference: string
    sub_ref: string
    comment: string
    data_sets: string[]
    //
    calculation?: undefined
}

export interface DERIVED_VALUE_REF {
    calculation: string
    // temporary fields before we implement the calculation automatically
    _manual_values: VALUES
    _manual_columns: COLUMNS

    created: string
    ref?: string
    sub_ref?: string
    comment?: string
    data_sets: string[]
    //
    values?: undefined
    columns?: undefined
}

// Limited from string | number | (string | number)[] because C# scripts to
// convert from json won't copy with this level of polymorphism
export type VALUES = number[][]

export type COLUMNS = (string | COLUMNS_REFERENCE)[]
export interface COLUMNS_REFERENCE {
    property: string
    values_file: string
}

interface UNIT {
    si: string
    conversion: {[unit: string]: number}
}
