import fs = require("fs")
import { ATTRIBUTE, PARENT_ATTRIBUTE, ATTRIBUTES, FILE_VALUE_REF } from "./schema"


export interface CAPACITY_SUMMARY {
    bucket_size: "year" | "month"
    subdivide_by_hour: boolean
}


function get_capacity_summary_name (summary: CAPACITY_SUMMARY)
{
    const hourly = summary.subdivide_by_hour ? "_hourly" : ""
    return `${summary.bucket_size}${hourly}_average`
}


function summarise_capacity_factor_data (get_data_file_path: (instance_id: string) => string, capacity_instances_to_summarise: ATTRIBUTES, summaries: CAPACITY_SUMMARY[])
{
    const instance_ids = Object.keys(capacity_instances_to_summarise)

    instance_ids.forEach((instance_id, capacity_index) => {
        const data_source_file_path = "./data/" + get_data_file_path(instance_id)
        const raw_capacity_data = fs.readFileSync(data_source_file_path).toString()
        const { latlons, data } = parse_capacity_data(raw_capacity_data)
        const summaried_data = get_summaries_of_data(summaries, latlons.length, data, capacity_index, instance_ids.length)
        //console.log("summaried_data...", summaried_data)

        const instance = capacity_instances_to_summarise[instance_id] as PARENT_ATTRIBUTE

        summaries.forEach(summary => {
            const summary_name = get_capacity_summary_name(summary)
            const summary_value_refs = (instance.attributes[summary_name] as ATTRIBUTE).value_refs

            if (summary_value_refs.length > 1) throw new Error("Current implementation expecting more than on value_ref")
            const summary_value_ref = summary_value_refs[0] as FILE_VALUE_REF

            const output_file_path = "./data/" + summary_value_ref.value_file

            //console.log(output_file_path)
            if (!summaried_data[summary_name]) return
            const contents = format_summaried_data(latlons, summaried_data[summary_name])
            fs.writeFileSync(output_file_path, contents)
        })
    })
}


type DataLine = [Date, ...number[]]
function parse_capacity_data (capacity_data: string)
{
    const lines = capacity_data.split("\n").map(line => line.trim())

    const header = lines[1] // header should be on line 1
        .slice(1, -1) // drop the first and last " character
        .split(`","`)
    if (header[0] !== `datetime`) throw new Error(`Expecting first header value to be datetime but was: ${header[0]}`)
    const latlons = header.slice(1)

    const lines_no_header: DataLine[] = lines.slice(2)
        .map(line => {
            const line_of_ints = line.split(",").map(v => parseInt(v, 10))
            const datetime = new Date(line_of_ints.shift()! * 1000)

            return [datetime, ...line_of_ints]
        })

    return { latlons, data: lines_no_header }
}


function get_summaries_of_data (
    summaries: CAPACITY_SUMMARY[],
    latlon_count: number,
    data: DataLine[],
    progress_outer_current: number,
    progress_outer_total: number
)
{
    const max_progress = (1 / summaries.length) * (1 / progress_outer_total)

    const summaried_data: {[summary_name: string]: DataLine[]} = {}
    summaries.forEach((summary, summary_index) => {
        const base_progress = (summary_index * max_progress) + (progress_outer_current / progress_outer_total)
        const summary_name = get_capacity_summary_name(summary)

        if (summary.subdivide_by_hour)
        {
            const get_bucket = factory_period_hourly_bucket(summary)
            summaried_data[summary_name] = get_summaries_of_data_by_period_hourly(get_bucket, latlon_count, data, base_progress, max_progress)
        }
        else
        {
            const segment_predicate = factory_segment_predicate(summary)
            summaried_data[summary_name] = get_summaries_of_data_by_period(segment_predicate, latlon_count, data, base_progress, max_progress)
        }

    })

    return summaried_data
}


function factory_period_hourly_bucket (summary: CAPACITY_SUMMARY): (datetime: Date) => Date
{
    if (!summary.subdivide_by_hour) throw new Error("factory_period_hourly_bucket only supports subdivide_by_hour")

    if (summary.bucket_size === "year")
    {
        return (datetime: Date) => {
            const d = new Date(datetime.getUTCFullYear().toString())
            d.setUTCHours(datetime.getUTCHours())
            return d
        }
    }
    else if (summary.bucket_size === "month")
    {
        return (datetime: Date) => {
            const d = new Date(`${datetime.getUTCFullYear()} ${datetime.getUTCMonth() + 1}`)
            d.setUTCHours(datetime.getUTCHours())
            return d
        }
    }
    else
    {
        throw new Error("factory_segment_predicate does not support bucket_size " + summary.bucket_size)
    }
}


function factory_segment_predicate (summary: CAPACITY_SUMMARY): (datetime: Date) => boolean
{
    if (summary.subdivide_by_hour) throw new Error("factory_segment_predicate does not support subdivide_by_hour")

    if (summary.bucket_size === "year")
    {
        return (datetime: Date) => (datetime.getUTCMonth() + datetime.getUTCDate() - 1 + datetime.getUTCHours() + datetime.getUTCMinutes() + datetime.getUTCSeconds()) === 0
    }
    else if (summary.bucket_size === "month")
    {
        return (datetime: Date) => (datetime.getUTCDate() - 1 + datetime.getUTCHours() + datetime.getUTCMinutes() + datetime.getUTCSeconds()) === 0
    }
    else
    {
        throw new Error("factory_segment_predicate does not support bucket_size " + summary.bucket_size)
    }
}


function get_summaries_of_data_by_period_hourly (get_bucket: (data_line: Date) => Date, latlon_count: number, data: DataLine[], base_progress: number, max_progress: number)
{
    const summary_data_lines: DataLine[] = []
    const buckets = new Set<number>()
    data.forEach(data_line => {
        const bucket = get_bucket(data_line[0])
        if (!buckets.has(bucket.getTime()))
        {
            summary_data_lines.push([bucket])
            buckets.add(bucket.getTime())
        }
    })

    for (let index = 0; index < latlon_count; ++index) {
        if (index % 20 === 0)
        {
            const progress = base_progress + ((index / latlon_count) * max_progress)
            console.log(`get_summaries_of_data ${(progress * 100).toFixed(0)}%`)
        }

        const data_for_bucket = Array.from(buckets)
            .reduce((accum, bucket) => {
                accum[bucket] = []
                return accum
            }, {} as {[bucket: number]: number[]})

        data.forEach(data_line => {
            const bucket = get_bucket(data_line[0])
            data_for_bucket[bucket.getTime()].push(data_line[index + 1] as number)
        })

        summary_data_lines.forEach(summary_data_line => {
            const bucket = summary_data_line[0].getTime()
            const data = data_for_bucket[bucket]
            const count = data.length
            const total = data.reduce((accum, v) => accum + v, 0)
            const average = total / count
            summary_data_line.push(average)
        })
    }

    return summary_data_lines
}


function get_summaries_of_data_by_period (should_segment: (data_line: Date) => boolean, latlon_count: number, data: DataLine[], base_progress: number, max_progress: number)
{
    const summary_data_lines: DataLine[] = []
    data.forEach(data_line => {
        if (should_segment(data_line[0]))
        {
            summary_data_lines.push([data_line[0]])
        }
    })

    for (let index = 0; index < latlon_count; ++index) {
        if (index % 20 === 0)
        {
            const progress = base_progress + ((index / latlon_count) * max_progress)
            console.log(`get_summaries_of_data ${(progress * 100).toFixed(0)}%`)
        }

        let current_data_line_index = 0
        let count = 0
        let total = 0
        data.forEach(data_line => {
            if (should_segment(data_line[0]) && count)
            {
                const average = total / count
                summary_data_lines[current_data_line_index].push(average)
                ++current_data_line_index
                count = 0
                total = 0
            }
            ++count
            total += (data_line[index + 1] as number)
        })

        if (count)
        {
            const average = total / count
            summary_data_lines[current_data_line_index].push(average)
        }
    }

    return summary_data_lines
}


function format_summaried_data (latlons: string[], summaried_data: DataLine[])
{
    const lines = [["datetime", ...latlons].map(v =>  `"${v}"`).join(",")]

    summaried_data.forEach(data_line => {
        const seconds_since_epoch = (data_line[0].getTime() / 1000).toString()
        const values = data_line.slice(1).map(v => (v as number).toFixed(0))
        lines.push([seconds_since_epoch, ...values].join(","))
    })

    return lines.join("\n")
}


export {
    get_capacity_summary_name,
    summarise_capacity_factor_data,
}
