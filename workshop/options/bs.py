"""
Reference Black-Scholes-Merton implementation (European, continuous
dividend yield). The Workshop options pricer runs the TypeScript version
in quartz/components/scripts/blackScholes.ts; test_parity.py checks the
two agree. This one uses math.erf for the normal CDF, so it is an
independent check on the TypeScript CDF approximation as well.
"""

from __future__ import annotations

import math


def norm_cdf(x: float) -> float:
    return 0.5 * (1.0 + math.erf(x / math.sqrt(2.0)))


def norm_pdf(x: float) -> float:
    return math.exp(-x * x / 2.0) / math.sqrt(2.0 * math.pi)


def black_scholes(type: str, S: float, K: float, T: float, r: float, q: float, sigma: float) -> dict:
    """Price and Greeks. vega and rho per 1 point (0.01), theta per calendar day."""
    df_r = math.exp(-r * T)
    df_q = math.exp(-q * T)

    if T <= 0 or sigma <= 0:
        if type == "call":
            price = max(S * df_q - K * df_r, 0.0)
            delta = df_q if S > K else 0.0
        else:
            price = max(K * df_r - S * df_q, 0.0)
            delta = -df_q if S < K else 0.0
        return {"price": price, "delta": delta, "gamma": 0.0, "vega": 0.0, "theta": 0.0, "rho": 0.0}

    sqrt_t = math.sqrt(T)
    d1 = (math.log(S / K) + (r - q + sigma * sigma / 2.0) * T) / (sigma * sqrt_t)
    d2 = d1 - sigma * sqrt_t
    pdf1 = norm_pdf(d1)

    gamma = df_q * pdf1 / (S * sigma * sqrt_t)
    vega = S * df_q * pdf1 * sqrt_t / 100.0
    decay = -S * df_q * pdf1 * sigma / (2.0 * sqrt_t)

    if type == "call":
        n1, n2 = norm_cdf(d1), norm_cdf(d2)
        return {
            "price": S * df_q * n1 - K * df_r * n2,
            "delta": df_q * n1,
            "gamma": gamma,
            "vega": vega,
            "theta": (decay - r * K * df_r * n2 + q * S * df_q * n1) / 365.0,
            "rho": K * T * df_r * n2 / 100.0,
        }
    m1, m2 = norm_cdf(-d1), norm_cdf(-d2)
    return {
        "price": K * df_r * m2 - S * df_q * m1,
        "delta": -df_q * m1,
        "gamma": gamma,
        "vega": vega,
        "theta": (decay + r * K * df_r * m2 - q * S * df_q * m1) / 365.0,
        "rho": -K * T * df_r * m2 / 100.0,
    }
