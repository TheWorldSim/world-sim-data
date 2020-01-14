import {
    SCHEMA,
    ATTRIBUTES,
    PARENT_ATTRIBUTE,
    ATTRIBUTE,
    VALUE_REF,
    DATA_SET_CONFIG,
} from "./schema"


export function validate_data_container(data_container: SCHEMA)
{
    const registered_data_sets = new Set<string>()

    data_container.data_sets.forEach(data_set => {
        data_set.versions.forEach(version =>
        {
            registered_data_sets.add(data_set.name + "@" + version)
        })

        registered_data_sets.add(data_set.name + "@" + data_set.draft_version)
    })

    let invalid = false
    
    invalid = validate_data_sets(data_container.data_sets, registered_data_sets) || invalid

    invalid = validate_data(data_container.data, registered_data_sets) || invalid

    if (invalid)
    {
        throw new Error("Invalid data_sets")
    }
}


function validate_data_sets(data_set_configs: DATA_SET_CONFIG[], registered_data_sets: Set<string>): boolean
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


function validate_data <U extends ATTRIBUTES> (data: U, data_sets: Set<string>): boolean
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
            invalid = validate_data(instances!, data_sets) || invalid
            validated = true
        }
        
        if (attributes)
        {
            invalid = validate_data(attributes, data_sets) || invalid
            validated = true
        }
        else
        {
            const value_refs = (object as ATTRIBUTE).value_refs
                        
            if (value_refs)
            {
                value_refs.map(value_ref => {
                    invalid = validate_value_ref(value_ref, data_sets) || invalid
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


function validate_value_ref (value_ref: VALUE_REF, data_sets: Set<string>): boolean
{
    let invalid = false

    value_ref.data_sets.forEach(data_set =>
    {
        if (!data_sets.has(data_set))
        {
            invalid = true
            console.warn(`Unregistered data_set: ${data_set}`)
        }
    })

    return invalid
}
