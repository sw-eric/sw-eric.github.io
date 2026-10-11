// Black-Scholes-Merton pricing for European options with a continuous
// dividend yield. Kept free of DOM code so the parity test
// (workshop/options/test_parity.py) can run it under Node and compare
// against the Python reference in workshop/options/bs.py.

export type OptionType = "call" | "put"

export interface BsInput {
  type: OptionType
  S: number // spot
  K: number // strike
  T: number // years to expiry
  r: number // risk-free rate, continuous, decimal
  q: number // dividend yield, continuous, decimal
  sigma: number // volatility, decimal
}

export interface BsResult {
  price: number
  delta: number
  gamma: number
  vega: number // per 1 vol point (0.01)
  theta: number // per calendar day
  rho: number // per 1 rate point (0.01)
}

// Standard normal CDF, Hart (1968) double-precision algorithm as given in
// West, "Better approximations to cumulative normal functions" (2005).
export function normCdf(x: number): number {
  const a = Math.abs(x)
  let c: number
  if (a > 37) {
    c = 0
  } else {
    const e = Math.exp((-a * a) / 2)
    if (a < 7.07106781186547) {
      let b = 3.52624965998911e-2 * a + 0.700383064443688
      b = b * a + 6.37396220353165
      b = b * a + 33.912866078383
      b = b * a + 112.079291497871
      b = b * a + 221.213596169931
      b = b * a + 220.206867912376
      c = e * b
      b = 8.83883476483184e-2 * a + 1.75566716318264
      b = b * a + 16.064177579207
      b = b * a + 86.7807322029461
      b = b * a + 296.564248779674
      b = b * a + 637.333633378831
      b = b * a + 793.826512519948
      b = b * a + 440.413735824752
      c = c / b
    } else {
      let b = a + 0.65
      b = a + 4 / b
      b = a + 3 / b
      b = a + 2 / b
      b = a + 1 / b
      c = e / b / 2.506628274631
    }
  }
  return x > 0 ? 1 - c : c
}

export function normPdf(x: number): number {
  return Math.exp((-x * x) / 2) / Math.sqrt(2 * Math.PI)
}

export function blackScholes({ type, S, K, T, r, q, sigma }: BsInput): BsResult {
  const dfR = Math.exp(-r * T)
  const dfQ = Math.exp(-q * T)

  // At or past expiry the option is worth its intrinsic value.
  if (T <= 0 || sigma <= 0) {
    const fwdIntrinsic =
      type === "call" ? Math.max(S * dfQ - K * dfR, 0) : Math.max(K * dfR - S * dfQ, 0)
    const itm = type === "call" ? S > K : S < K
    return {
      price: fwdIntrinsic,
      delta: itm ? (type === "call" ? dfQ : -dfQ) : 0,
      gamma: 0,
      vega: 0,
      theta: 0,
      rho: 0,
    }
  }

  const sqrtT = Math.sqrt(T)
  const d1 = (Math.log(S / K) + (r - q + (sigma * sigma) / 2) * T) / (sigma * sqrtT)
  const d2 = d1 - sigma * sqrtT
  const pdf1 = normPdf(d1)

  const gamma = (dfQ * pdf1) / (S * sigma * sqrtT)
  const vega = (S * dfQ * pdf1 * sqrtT) / 100
  const decay = (-S * dfQ * pdf1 * sigma) / (2 * sqrtT)

  if (type === "call") {
    const Nd1 = normCdf(d1)
    const Nd2 = normCdf(d2)
    return {
      price: S * dfQ * Nd1 - K * dfR * Nd2,
      delta: dfQ * Nd1,
      gamma,
      vega,
      theta: (decay - r * K * dfR * Nd2 + q * S * dfQ * Nd1) / 365,
      rho: (K * T * dfR * Nd2) / 100,
    }
  }
  const Nm1 = normCdf(-d1)
  const Nm2 = normCdf(-d2)
  return {
    price: K * dfR * Nm2 - S * dfQ * Nm1,
    delta: -dfQ * Nm1,
    gamma,
    vega,
    theta: (decay + r * K * dfR * Nm2 - q * S * dfQ * Nm1) / 365,
    rho: (-K * T * dfR * Nm2) / 100,
  }
}

// Position-level outcomes at expiry for the strategies the investment
// mandate permits: long call, long put, cash-secured short put.
export type Strategy = "long_call" | "long_put" | "short_put"

export interface PositionOutcome {
  breakeven: number
  maxLoss: number | null // null = unlimited
  maxGain: number | null // null = unlimited
  cashRequired: number | null
}

export function positionOutcome(
  strategy: Strategy,
  K: number,
  premium: number,
  contracts: number,
  multiplier = 100,
): PositionOutcome {
  const n = contracts * multiplier
  switch (strategy) {
    case "long_call":
      return { breakeven: K + premium, maxLoss: premium * n, maxGain: null, cashRequired: null }
    case "long_put":
      return {
        breakeven: K - premium,
        maxLoss: premium * n,
        maxGain: Math.max(K - premium, 0) * n,
        cashRequired: null,
      }
    case "short_put":
      return {
        breakeven: K - premium,
        maxLoss: Math.max(K - premium, 0) * n,
        maxGain: premium * n,
        cashRequired: K * n,
      }
  }
}

// P&L at expiry for one underlying price, whole position.
export function expiryPnl(
  strategy: Strategy,
  K: number,
  premium: number,
  ST: number,
  contracts: number,
  multiplier = 100,
): number {
  const n = contracts * multiplier
  if (strategy === "long_call") return (Math.max(ST - K, 0) - premium) * n
  if (strategy === "long_put") return (Math.max(K - ST, 0) - premium) * n
  return (premium - Math.max(K - ST, 0)) * n
}
