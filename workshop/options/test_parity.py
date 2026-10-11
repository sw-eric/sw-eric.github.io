"""
Checks the TypeScript pricer (quartz/components/scripts/blackScholes.ts)
against the Python reference (bs.py) on every case in cases.json, plus
the textbook values from Hull, Options, Futures, and Other Derivatives,
Example 15.6 (call 4.76, put 0.81).

Run from the repo root:
    python3 -m unittest workshop/options/test_parity.py
Needs Node; the TypeScript side runs through `npx tsx`.
"""

from __future__ import annotations

import json
import math
import subprocess
import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(HERE))
from bs import black_scholes  # noqa: E402

FIELDS = ("price", "delta", "gamma", "vega", "theta", "rho")
TOL = 1e-9

TS_RUNNER = """
import { blackScholes } from "./quartz/components/scripts/blackScholes.ts"
import { readFileSync } from "node:fs"
const cases = JSON.parse(readFileSync(process.argv[process.argv.length - 1], "utf8"))
process.stdout.write(JSON.stringify(cases.map((c) => blackScholes(c))))
"""


def run_typescript(cases_path: Path) -> list[dict]:
    out = subprocess.run(
        ["npx", "--no-install", "tsx", "--eval", TS_RUNNER, str(cases_path)],
        cwd=ROOT, capture_output=True, text=True, check=True,
    )
    return json.loads(out.stdout)


class ParityTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.cases_path = HERE / "cases.json"
        cls.cases = json.loads(cls.cases_path.read_text())
        cls.ts = run_typescript(cls.cases_path)

    def test_textbook_values(self):
        call = black_scholes("call", 42, 40, 0.5, 0.10, 0, 0.20)["price"]
        put = black_scholes("put", 42, 40, 0.5, 0.10, 0, 0.20)["price"]
        self.assertAlmostEqual(call, 4.76, places=2)
        self.assertAlmostEqual(put, 0.81, places=2)

    def test_put_call_parity(self):
        for c in self.cases:
            if c["T"] <= 0:
                continue
            args = {k: c[k] for k in ("S", "K", "T", "r", "q", "sigma")}
            call = black_scholes("call", **args)["price"]
            put = black_scholes("put", **args)["price"]
            fwd = c["S"] * math.exp(-c["q"] * c["T"]) - c["K"] * math.exp(-c["r"] * c["T"])
            self.assertAlmostEqual(call - put, fwd, places=9, msg=c["name"])

    def test_typescript_matches_python(self):
        self.assertEqual(len(self.ts), len(self.cases))
        for c, ts in zip(self.cases, self.ts):
            py = black_scholes(c["type"], c["S"], c["K"], c["T"], c["r"], c["q"], c["sigma"])
            for f in FIELDS:
                with self.subTest(case=c["name"], field=f):
                    diff = abs(py[f] - ts[f])
                    self.assertLessEqual(diff, TOL * max(1.0, abs(py[f])), f"py={py[f]!r} ts={ts[f]!r}")


if __name__ == "__main__":
    unittest.main()
