"""
DC power flow on a small grid using the KCL + KVL equations from the slide.

    KCL:  p_i = sum_l K[i, l] * f_l              for i = 1..N-1   (N-1 equations)
    KVL:  sum_l C[c, l] * x_l * f_l = 0          for each cycle c (L-N+1 equations)

Together that is L independent linear equations for the L line flows f_l.

AC and DC lines
  * AC lines obey KVL: their flow is fixed by the reactances x_pu.
  * DC lines (CSV column dc = 1) are controllable. They obey KCL and their
    capacity limit but are left out of the cycle matrix C, so their flow is a
    free decision. With DC lines the equations no longer determine a unique
    answer, so a linear programme chooses the flows: first maximise the demand
    served, then (among equally good solutions) minimise the total flow
    sum_l |f_l|. A DC flow may be negative (against bus0 -> bus1).
  * analyse(..., hvdc_setpoints={"8": 200.0}) optionally fixes chosen DC lines
    to a given flow in MW; DC lines without a setpoint are chosen automatically.

Sign conventions
  * p_i > 0  -> bus i is a source (net injection)
  * p_i < 0  -> bus i is a sink   (net demand)
  * f_l > 0  -> power flows from the line's start node to its end node

Note on C: your matrix is written with one row per cycle and one column per
line (shape 2 x 7), so it is indexed C[c, l] here. The slide writes C_{lc};
that is just the transpose of the same thing.

What the script does
  1. Balance the request: if total generation != total demand, the larger side
     is scaled down proportionally (surplus at sources or shortage at sinks).
  2. Solve the linear system above for the line flows.
  3. If you supply line capacities and some flow exceeds its limit, solve a
     small linear programme instead: maximise the demand that is served
     subject to KCL, KVL and |f_l| <= cap_l. Any extra shortage/surplus that
     this causes is reported per bus.
"""

from dataclasses import dataclass
from pathlib import Path

import numpy as np
from scipy.optimize import linprog
import networkx as nx
import pandas as pd


# --------------------------------------------------------------------------
# Network -> matrices
# --------------------------------------------------------------------------
@dataclass
class Grid:
    buses: list[str]                      # length N, row order of K
    lines: list[str]                      # length L, column order of K, C, x, cap
    line_ends: dict[str, tuple[str, str]]  # line -> (start bus, end bus)
    K: np.ndarray                         # (N, L) incidence, +1 at start, -1 at end
    C: np.ndarray                         # (cycles, L) cycle matrix of the AC lines only
    x: np.ndarray                         # (L,) reactance x_pu (0 for DC lines)
    cap: np.ndarray                       # (L,) capacity limit s_nom in MW
    is_dc: np.ndarray                     # (L,) True for controllable DC lines


def load_network(path: Path) -> nx.DiGraph:
    """Read the edge CSV into a directed graph (edge direction = bus0 -> bus1).

    AC lines with a non-finite reactance (open circuits, e.g. x_pu = inf) carry
    no flow and would make the KVL equations singular, so they are dropped. DC
    lines (dc = 1) do not need a reactance. A missing dc column means all AC.
    """
    df = pd.read_csv(path, dtype={"Line": str, "bus0": str, "bus1": str, "x_pu": str})
    # Values such as "2.558-04" are missing the exponent marker
    df["x_pu"] = pd.to_numeric(
        df["x_pu"].str.replace(r"(?<=\d)-(?=\d+$)", "e-", regex=True))
    df["s_nom"] = pd.to_numeric(df["s_nom"])
    if "dc" not in df:
        df["dc"] = 0
    df["dc"] = df["dc"].fillna(0).astype(int).astype(bool)

    open_circuit = ~df["dc"] & ~np.isfinite(df["x_pu"])
    if open_circuit.any():
        print("Dropping lines with non-finite reactance:",
              ", ".join(df.loc[open_circuit, "Line"]))
        df = df[~open_circuit]

    return nx.from_pandas_edgelist(df, "bus0", "bus1",
                                   edge_attr=["Line", "x_pu", "s_nom", "dc"],
                                   create_using=nx.DiGraph)


def grid_from_network(network: nx.DiGraph) -> Grid:
    """Build K, C, x, cap and is_dc from a directed graph with Line, x_pu, s_nom, dc edge attributes."""
    if not nx.is_weakly_connected(network):
        raise ValueError("The network must be connected.")
    if any(network.has_edge(v, u) for u, v in network.edges):
        raise ValueError("Antiparallel / duplicate lines are not supported.")

    buses = [str(b) for b in network.nodes]
    edges = list(network.edges)           # fixed order = column order
    lines = [str(network.edges[e]["Line"]) for e in edges]
    line_ends = {name: (str(u), str(v)) for name, (u, v) in zip(lines, edges)}

    # networkx puts -1 at the tail and +1 at the head; the KCL convention here
    # is the opposite (f > 0 leaves the start node), hence the minus sign.
    K = -nx.incidence_matrix(network, nodelist=network.nodes, edgelist=edges,
                             oriented=True).toarray()

    is_dc = np.array([bool(network.edges[e]["dc"]) for e in edges])

    # One row per fundamental cycle of the AC lines only (a DC link breaks KVL);
    # +1 if the cycle traverses a line from its start to its end node, -1 if against.
    col = {e: l for l, e in enumerate(edges)}
    ac_graph = nx.Graph()
    ac_graph.add_nodes_from(network.nodes)
    ac_graph.add_edges_from(e for e, dc in zip(edges, is_dc) if not dc)
    cycles = nx.cycle_basis(ac_graph)
    C = np.zeros((len(cycles), len(edges)))
    for c, cycle in enumerate(cycles):
        for u, v in zip(cycle, cycle[1:] + cycle[:1]):
            if (u, v) in col:
                C[c, col[(u, v)]] = 1.0
            else:
                C[c, col[(v, u)]] = -1.0

    # Reactance is meaningless for DC lines; zero keeps C * x free of NaN.
    x = np.array([0.0 if dc else network.edges[e]["x_pu"]
                  for e, dc in zip(edges, is_dc)], dtype=float)
    cap = np.array([network.edges[e]["s_nom"] for e in edges], dtype=float)
    return Grid(buses, lines, line_ends, K, C, x, cap, is_dc)


# --------------------------------------------------------------------------
# Core solver: exactly the equations on the slide
# --------------------------------------------------------------------------
def solve_flows(p, grid: Grid):
    """Line flows f for a *balanced* injection vector p (sum(p) must be 0)."""
    K, C, x = grid.K, grid.C, grid.x
    p = np.asarray(p, dtype=float)
    N, L = K.shape
    if abs(p.sum()) > 1e-9:
        raise ValueError("Injections must sum to zero for the KCL equations "
                         "(the N-th equation is linearly dependent).")
    A = np.vstack([K[:N - 1],        # KCL for buses 1..N-1
                   C * x])           # KVL: sum_l C[c,l] x_l f_l = 0
    b = np.concatenate([p[:N - 1], np.zeros(C.shape[0])])
    return np.linalg.solve(A, b)


# --------------------------------------------------------------------------
# Dispatch LP, used when a line limit is violated or the grid has DC lines
# --------------------------------------------------------------------------
_LP_OPTIONS = {"primal_feasibility_tolerance": 1e-10,
               "dual_feasibility_tolerance": 1e-10}


def _redispatch(gen_avail, load_req, grid: Grid, setpoints=None):
    """Maximise served demand subject to KCL, KVL and line limits.

    Variables z = [f (L), g (N), d (N), t (L)] with g = dispatched generation,
    d = served demand and t >= |f| (only when the grid has DC lines).
    Equality: K f = g - d (all N buses), C diag(x) f = 0 (AC cycles only).

    DC lines make the flows non-unique, so a second LP fixes the served demand
    at its optimum and minimises the total flow sum(t). `setpoints` maps line
    index -> fixed flow in MW for DC lines the user wants to pin.
    """
    K, C, x, cap = grid.K, grid.C, grid.x, grid.cap
    N, L = K.shape
    tie_break = bool(grid.is_dc.any())
    n_t = L if tie_break else 0
    n_var = L + 2 * N + n_t

    A_eq = np.zeros((N + C.shape[0], n_var))
    A_eq[:N, :L] = K
    A_eq[:N, L:L + N] = -np.eye(N)
    A_eq[:N, L + N:L + 2 * N] = np.eye(N)
    A_eq[N:, :L] = C * x
    b_eq = np.zeros(A_eq.shape[0])

    bounds = [(-c if np.isfinite(c) else None, c if np.isfinite(c) else None)
              for c in cap]
    for l, s in (setpoints or {}).items():
        bounds[l] = (s, s)
    bounds += [(0, a) for a in gen_avail]
    bounds += [(0, r) for r in load_req]
    bounds += [(0, None)] * n_t

    A_ub = b_ub = None
    if tie_break:                            # t >= f and t >= -f
        A_ub = np.zeros((2 * L, n_var))
        A_ub[:L, :L] = np.eye(L)
        A_ub[L:, :L] = -np.eye(L)
        A_ub[:, L + 2 * N:] = -np.vstack([np.eye(L), np.eye(L)])
        b_ub = np.zeros(2 * L)

    cost = np.zeros(n_var)
    cost[L + N:L + 2 * N] = -1.0             # maximise sum(d)

    res = linprog(cost, A_ub=A_ub, b_ub=b_ub, A_eq=A_eq, b_eq=b_eq,
                  bounds=bounds, method="highs", options=_LP_OPTIONS)
    if not res.success:
        raise RuntimeError(f"Redispatch LP failed: {res.message}")

    if tie_break:
        served = res.x[L + N:L + 2 * N].sum()
        row = np.zeros((1, n_var))
        row[0, L + N:L + 2 * N] = -1.0       # sum(d) >= served (with tolerance)
        A_ub2 = np.vstack([A_ub, row])
        b_ub2 = np.append(b_ub, -served + 1e-9)
        cost2 = np.zeros(n_var)
        cost2[L + 2 * N:] = 1.0              # minimise sum(t)
        res = linprog(cost2, A_ub=A_ub2, b_ub=b_ub2, A_eq=A_eq, b_eq=b_eq,
                      bounds=bounds, method="highs", options=_LP_OPTIONS)
        if not res.success:
            raise RuntimeError(f"Redispatch LP (flow tie-break) failed: {res.message}")

    z = res.x
    return z[L:L + N], z[L + N:L + 2 * N], z[:L]       # g, d, f


# --------------------------------------------------------------------------
# Main entry point
# --------------------------------------------------------------------------
def analyse(network: nx.DiGraph, power_imbalances: dict[str, float], tol=1e-9,
            hvdc_setpoints: dict[str, float] | None = None):
    """
    power_imbalances : dict like {"1": 100.0, "5": -80.0} in MW
                       (+ source, - sink; missing = 0)
    hvdc_setpoints   : optional dict like {"8": 200.0}, line name -> flow in MW
                       (+ = bus0 -> bus1) for DC lines. DC lines not listed are
                       chosen automatically (max served demand, then min flow).
    """
    grid = grid_from_network(network)
    K, C, x, cap_arr = grid.K, grid.C, grid.x, grid.cap
    N, L = K.shape
    p = np.array([power_imbalances.get(b, 0.0) for b in grid.buses], dtype=float)

    setpoints = {}
    for name, flow in (hvdc_setpoints or {}).items():
        if name not in grid.lines or not grid.is_dc[grid.lines.index(name)]:
            raise ValueError(f"hvdc_setpoints: line {name!r} is not a DC line.")
        l = grid.lines.index(name)
        if abs(flow) > cap_arr[l]:
            raise ValueError(f"hvdc_setpoints: {flow} MW exceeds the "
                             f"{cap_arr[l]} MW capacity of line {name!r}.")
        setpoints[l] = float(flow)

    gen_avail = np.clip(p, 0, None)
    load_req = np.clip(-p, 0, None)

    if grid.is_dc.any():
        # DC flows are free decisions, so the KCL + KVL system is under-determined
        g, d, f = _redispatch(gen_avail, load_req, grid, setpoints)
        method = "LP dispatch (DC lines controllable)"
    else:
        G, D = gen_avail.sum(), load_req.sum()

        # Step 1: system-level balance (scale the larger side down proportionally)
        served = min(G, D)
        g = gen_avail * (served / G) if G > 0 else np.zeros(N)
        d = load_req * (served / D) if D > 0 else np.zeros(N)

        # Step 2: KCL + KVL linear solve
        f = solve_flows(g - d, grid)
        method = "KCL + KVL linear solve"

        # Step 3: line limits -> LP redispatch if needed
        if np.any(np.abs(f) > cap_arr + tol):
            g, d, f = _redispatch(gen_avail, load_req, grid)
            method = "LP redispatch (line limits binding)"

    kvl = C @ (x * f)
    return {
        "grid": grid,
        "method": method,
        "p_requested": p,
        "gen_available": gen_avail, "gen_dispatched": g,
        "load_requested": load_req, "load_served": d,
        "surplus": gen_avail - g,          # unused generation at sources
        "shortage": load_req - d,          # unserved demand at sinks
        "flows": f, "cap": cap_arr,
        "kcl_residual": float(np.max(np.abs(K @ f - (g - d)))),
        "kvl_residual": float(np.max(np.abs(kvl))) if kvl.size else 0.0,
    }


def report(r, name=""):
    grid = r["grid"]
    print("=" * 66)
    print(f"Scenario: {name}")
    print(f"Method  : {r['method']}")
    print("-" * 66)
    print(f"{'bus':<4}{'requested':>10}{'delivered':>11}{'shortage':>10}{'surplus':>10}")
    for i, b in enumerate(grid.buses):
        net = r["gen_dispatched"][i] - r["load_served"][i]
        print(f"{b:<4}{r['p_requested'][i]:>10.3f}{net:>11.3f}"
              f"{r['shortage'][i]:>10.3f}{r['surplus'][i]:>10.3f}")
    print("-" * 66)
    print(f"{'line':<6}{'type':<5}{'from->to':<9}{'flow':>9}{'limit':>9}{'loading':>9}")
    for l, name_l in enumerate(grid.lines):
        a, b = grid.line_ends[name_l]
        cap = r["cap"][l]
        cap_s = f"{cap:.3f}" if np.isfinite(cap) else "inf"
        load_s = f"{100 * abs(r['flows'][l]) / cap:.0f}%" if np.isfinite(cap) else "-"
        flag = "  <-- at limit" if np.isfinite(cap) and abs(r["flows"][l]) >= cap - 1e-7 else ""
        kind = "DC" if grid.is_dc[l] else "AC"
        print(f"{name_l:<6}{kind:<5}{a + '->' + b:<9}{r['flows'][l]:>9.4f}{cap_s:>9}{load_s:>9}{flag}")
    print("-" * 66)
    ok = r["shortage"].sum() < 1e-7
    print(f"Demand requested {r['load_requested'].sum():.3f} | "
          f"served {r['load_served'].sum():.3f} | "
          f"total shortage {r['shortage'].sum():.3f} | "
          f"total surplus {r['surplus'].sum():.3f}")
    print("All demand served." if ok else "Some demand could NOT be served.")
    print(f"(KCL residual {r['kcl_residual']:.1e}, KVL residual {r['kvl_residual']:.1e})")


# --------------------------------------------------------------------------
# Examples - edit the injections and capacities to try your own cases
# --------------------------------------------------------------------------
if __name__ == "__main__":
    network = load_network(Path(__file__).with_name("simple_edges.csv"))

    # 1) Balanced case: every line within its limit
    report(analyse(network, {"1": 300.0, "3": 100.0, "5": -250.0, "6": -150.0}),
           "balanced, within limits")

    # 2) More generation than demand -> surplus at the sources
    report(analyse(network, {"1": 300.0, "3": 100.0, "5": -100.0, "6": -100.0}),
           "generation exceeds demand (surplus at sources)")

    # 3) More demand than generation -> shortage at the sinks
    report(analyse(network, {"1": 300.0, "5": -250.0, "6": -200.0}),
           "demand exceeds generation (shortage at sinks)")

    # 4) Balanced on paper, but the 1-2 line (491.5 MW) limits what bus 1 can export
    report(analyse(network, {"1": 900.0, "6": -900.0}),
           "congestion: line limit causes shortage and surplus")

    # 5) Two AC areas (buses 1-2 and 3-4) joined only by a DC line
    bridge = load_network(Path(__file__).with_name("simple_edges_dc_bridge.csv"))
    report(analyse(bridge, {"1": -600.0, "2": 200.0, "3": -200.0, "4": 600.0}),
           "DC bridge between two AC areas")
