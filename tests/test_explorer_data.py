"""The explorer's datasets must reconcile with each other and with their sources."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
D = ROOT / "web/data/explorer"
pop = json.loads((ROOT / "web/data/population.json").read_text())
comp = json.loads((D / "components.json").read_text())["data"]
flows = json.loads((D / "flows.json").read_text())
pol = json.loads((D / "politics.json").read_text())
PROV = ["NL", "PE", "NS", "NB", "QC", "ON", "MB", "SK", "AB", "BC", "YT"]


def popjul(geo, year):
    i = pop["dates"].index(f"{year}-07-01")
    return pop["series"][geo][i]


def test_components_reconcile_with_population_change():
    """July-to-July population change = births − deaths + immigrants − net emigration + net NPR + net interprovincial + residual."""
    worst = 0
    for geo in PROV + ["CAN"]:
        for y in range(1971, 2025):
            c = comp[geo].get(str(y))
            if not c:
                continue
            growth = (c["births"] - c["deaths"] + c["immigrants"] - c["net_emigration"] + c.get("net_npr", 0)
                      + c.get("net_interprovincial", 0) + c.get("residual", 0))
            actual = popjul(geo, y + 1) - popjul(geo, y)
            worst = max(worst, abs(growth - actual))
            assert abs(growth - actual) <= 2, (geo, y, growth, actual)  # rounding tolerance of 2 people
    print("worst gap", worst)


def test_net_interprovincial_sums_to_zero_nationally():
    for y in range(1971, 2025):
        keys = [k for k in comp if k not in ("CAN",) and str(y) in comp[k]]
        total = sum(comp[k][str(y)].get("net_interprovincial", 0) for k in keys if not (k == "NT+NU" and "NT" in keys and str(y) in comp.get("NT", {})))
        assert abs(total) <= 2, (y, total)


def test_flows_net_matches_component_net():
    for p in flows["complete_periods"]:
        net = {}
        for o, d, v in flows["data"][str(p)]:
            net[o] = net.get(o, 0) - v
            net[d] = net.get(d, 0) + v
        for geo in ["AB", "BC", "ON", "QC"]:
            c = comp[geo][str(p)]["net_interprovincial"]
            assert abs(net[geo] - c) <= 2, (p, geo, net[geo], c)


def test_elections_are_complete():
    dates = [e["date"] for e in pol["elections"]]
    assert dates[0] == "1972-10-30" and dates[-1] == "2025-04-28" and len(dates) == 17
    for e in pol["elections"][:-1]:
        assert e["seats_recorded"] in (264, 282, 295, 301, 308, 338), e["date"]
