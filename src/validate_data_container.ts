import fs = require("fs")

import {
    SCHEMA,
    ATTRIBUTES,
    PARENT_ATTRIBUTE,
    ATTRIBUTE,
    VALUE_REF,
    DATA_SET_CONFIG,
    FILE_VALUE_REF,
} from "./schema"
import { value_file_to_file_path } from "./process_data"


export function validate_data_container(data_container: SCHEMA)
{
    let invalid = false
    invalid = validate_data_set_configs(data_container.data_set_configs) || invalid
    
    const registered_data_sets = get_registered_data_sets(data_container.data_set_configs)
    invalid = validate_data(data_container.data, registered_data_sets) || invalid

    if (invalid)
    {
        throw new Error("Invalid data_container")
    }
}


function get_registered_data_sets (data_set_configs: DATA_SET_CONFIG[])
{
    const registered_data_sets = new Set<string>()

    data_set_configs.forEach(data_set_config => {
        data_set_config.versions.forEach(version =>
        {
            registered_data_sets.add(data_set_config.name + "@" + version)
        })

        registered_data_sets.add(data_set_config.name + "@" + data_set_config.draft_version)
    })

    return registered_data_sets
}


function validate_data_set_configs(data_set_configs: DATA_SET_CONFIG[]): boolean
{
    let invalid = false

    data_set_configs.forEach(data_set_config => {
        if (data_set_config.versions.find(v => v === data_set_config.draft_version))
        {
            invalid = true
            console.warn(`draft_version should not be a registered version: ${data_set_config.name} @ ${data_set_config.draft_version}`)
        }

        if (!data_set_config.versions.find(v => v === data_set_config.release_version))
        {
            invalid = true
            console.warn(`Unregistered release_version: ${data_set_config.name} @ ${data_set_config.release_version}`)
        }
    })

    return invalid
}


function validate_data <U extends ATTRIBUTES> (data: U, registered_data_sets: Set<string>): boolean
{
    let invalid = false

    Object.keys(data).forEach(key => 
    {
        const object = data[key]

        let validated = false

        const instances = (object as PARENT_ATTRIBUTE).instances
        const attributes = (object as PARENT_ATTRIBUTE).attributes

        if (instances)
        {
            invalid = validate_data(instances!, registered_data_sets) || invalid
            validated = true
        }
        
        if (attributes)
        {
            invalid = validate_data(attributes, registered_data_sets) || invalid
            validated = true
        }
        else
        {
            const value_refs = (object as ATTRIBUTE).value_refs
                        
            if (value_refs)
            {
                value_refs.map(value_ref => {
                    invalid = validate_value_ref(value_ref, registered_data_sets) || invalid
                })
                validated = true
            }
            else if (!validated)
            {
                throw new Error("object not validated and does not have `attributes` or `value_refs`: " + JSON.stringify(object))
            }
        }
    })

    return invalid
}


function validate_value_ref (value_ref: VALUE_REF, registered_data_sets: Set<string>): boolean
{
    let invalid = false

    invalid = validate_value_ref_data_sets(value_ref.data_sets, registered_data_sets) || invalid
    invalid = validate_value_ref_value_file(value_ref) || invalid

    return invalid
}


function validate_value_ref_data_sets (data_sets: string[], registered_data_sets: Set<string>): boolean
{
    let invalid = false

    data_sets.forEach(data_set =>
    {
        if (!registered_data_sets.has(data_set))
        {
            invalid = true
            console.warn(`Unregistered data_set: ${data_set}`)
        }
    })

    return invalid
}


function validate_value_ref_value_file (value_ref: VALUE_REF)
{
    let invalid = false

    const value_file = (value_ref as FILE_VALUE_REF).value_file;
    
    if (value_file)
    {
        const file_path = value_file_to_file_path(value_file)
        if (!fs.existsSync(file_path))
        {
            invalid = true
            console.warn(`file_path does not exist: ${file_path}`)
        }
    }

    return invalid
}
