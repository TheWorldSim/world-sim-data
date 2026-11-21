import type { CellularLynk } from "./interface.ts"
import type { PowerBalance } from "./power_balance.ts"


/** Net flow along a lynk in MW, positive when it runs the same way as the lynk's path_cell_ids */
export function lynk_flow_MW(lynk: CellularLynk, power_balance: Pick<PowerBalance, "MW_by_line_id" | "MW_by_link_id">): number
{
    const { MW_by_line_id, MW_by_link_id } = power_balance

    let flow_MW = 0
    lynk.ac_lines.forEach(line => flow_MW += (MW_by_line_id[line.id] ?? 0) * line.direction)
    lynk.dc_links.forEach(link => flow_MW += (MW_by_link_id[link.id] ?? 0) * link.direction)
    return flow_MW
}
