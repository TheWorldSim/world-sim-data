import { SCHEMA } from "./schema"
import { process_data } from "./process-data"
import { validate_data_container } from "./validate-data-container"


export function process_data_container (data_container: SCHEMA): SCHEMA
{
    const processed_data_container = {
        ...data_container,
        data: process_data(data_container.data),
    }

    validate_data_container(processed_data_container)

    return processed_data_container
}

