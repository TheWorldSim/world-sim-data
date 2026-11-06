// Copied from https://wikisim.org/wiki/1257v3


export const d1257v3_parse_number_from_string = (text, thousands_symbols = ",_ ", decimal_symbol = ".") =>
{
    const thousands_symbols_regex = new RegExp(`[${thousands_symbols}]`, "g")

    let modified_text = text.trim()
    modified_text = modified_text.replaceAll(thousands_symbols_regex, "")
    modified_text = modified_text.replace(decimal_symbol, ".")

    const number = parseFloat(modified_text)
    if (Number.isNaN(number)) return text

    const valid_number_regex = /^[-+]?\d+\.?\d*\s*(e\s*[-+]?\d+\.?\d*)?$/
    if (!valid_number_regex.test(modified_text)) return modified_text

    return number
}
