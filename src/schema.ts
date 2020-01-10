
export interface SCHEMA {
    schema_version: "0.2"
    data: ATTRIBUTES
    units: {[unit_type: string]: UNIT}
    data_sets: {[data_set_name: string]: DATA_SET}
}

interface DATA_SET {
    draft_version: string
    release_version: string
    _auto_versions: {[unit_type: string]: boolean}
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
    values: VALUE[]
} & COMMON_VALUE_DEF

export type REFERENCE_VALUE_REF = {
    value_file: string
} & COMMON_VALUE_DEF

interface COMMON_VALUE_DEF {
    columns?: (string | string[])[]
    created: string
    meta_data?: {
        units: {[key: string]: VALUE}
        params: {[key: string]: VALUE}
    }
    reference: string
    sub_ref?: string
    comment?: string
    data_sets: string[]
    //
    calculation?: undefined
    _auto_values?: undefined
    _auto_columns?: undefined
}

interface DERIVED_VALUE_REF {
    calculation: string
    created: string
    _auto_values: VALUE[]
    _auto_columns: string[]
    data_sets: string[]
    //
    columns?: undefined
    ref?: undefined
    sub_ref?: undefined
    comment?: undefined
}

export type VALUE = string | number | (string | number)[]

interface UNIT {
    si: string
    conversion: {[unit: string]: number}
}
