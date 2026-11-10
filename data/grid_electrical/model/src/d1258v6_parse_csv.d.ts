

interface Options
{
    delimiter?: string
    parse_numbers?: boolean
    trim_fields?: boolean
    ignore_rows?: number
}


export declare function d1258v6_parse_csv(csv_data: string, options?: Options): (string | number)[][]
