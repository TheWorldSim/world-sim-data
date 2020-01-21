import { SCHEMA } from "./schema"
import { process_data } from "./process_data"
import { validate_data_container } from "./validate_data_container"


export function process_data_container (data_container: SCHEMA): SCHEMA
{
    const processed_data_container = {
        ...data_container,
        data: process_data(data_container.data),
    }

    validate_data_container(processed_data_container)

    return processed_data_container
}

