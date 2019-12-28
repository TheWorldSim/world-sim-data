
export interface SCHEMA_0_1 {
    schema_version: "0.1"
    data: ATTRIBUTES
    units: {[unit_type: string]: UNIT}
    data_sets: {[data_set_name: string]: DATA_SET}
}

interface DATA_SET {
    draft_version: string
    release_version: string
    _auto_versions: {[unit_type: string]: boolean}
}

type ATTRIBUTES = {[attribute_name: string]: ATTRIBUTE | ABSTRACT_ATTRIBUTE | INSTANCE_ATTRIBUTE }
interface ABSTRACT_ATTRIBUTE {
    instances: ATTRIBUTES
    attributes: ATTRIBUTES
}
interface INSTANCE_ATTRIBUTE {
    attributes: ATTRIBUTES
}

interface ATTRIBUTE {
    value_refs: (VALUE_REF | DERIVED_VALUE)[]
    labels?: string[]
    description?: string
}

interface VALUE_REF {
    values: VALUE[]
    columns?: string[]
    reference: string
    sub_ref?: string
    comment?: string
    data_sets: string[]
    //
    calculation?: undefined
    _auto_values?: undefined
    _auto_columns?: undefined
}

interface DERIVED_VALUE {
    calculation: string
    _auto_values: VALUE[]
    _auto_columns: string[]
    data_sets: string[]
    //
    columns?: undefined
    ref?: undefined
    sub_ref?: undefined
    comment?: undefined
}

type VALUE = string | number | (string | number)[]

interface UNIT {
    si: string
    conversion: {[unit: string]: number}
}
