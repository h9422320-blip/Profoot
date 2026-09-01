# Payment gateway failures — Guinea, Burkina Faso, Mali, Togo

**Store:** Profoot
**Reported:** 26 August 2026
**Severity:** High — ongoing revenue loss, most recent failure today at 18:38 UTC

---

## Summary

Over the past two weeks, mobile money payments from **Guinea, Burkina Faso, Mali and Togo** fail at a rate that cannot be explained by customer behaviour. In these four countries, **not a single failure is due to insufficient balance** — the customers have the funds. The gateway rejects them.

By contrast, in Côte d'Ivoire and Cameroon the same store converts normally, and failures there are overwhelmingly `INSUFFICIENT_BALANCE`, which is expected and not a platform issue.

We analysed **384 failed and 337 successful sales** individually through the API.

---

## The evidence, country by country

### Guinea — Orange Money: 1 success out of 48 attempts

| | |
|---|---|
| Attempts with Orange Money | 48 |
| Successful | **1** |
| Failed | **47** |
| Dominant error | `UNSPECIFIED_FAILURE` — **46 of 47** |
| Insufficient balance | **0** |

Sample sale IDs (all Orange Money, all `UNSPECIFIED_FAILURE`):

```
SALE12M22PUF63H8UXI   2026-08-26 17:42   F CFA 5,000
SALEPDLUZLHP751DP8B   2026-08-25 06:43   F CFA 5,000
SALEIUIPPVVCXIM5XLF   2026-08-25 06:39   F CFA 5,000
SALEGIDFHZ61MOWDZL9   2026-08-24 23:31   F CFA 2,000
SALE3808E7UWT9EQXWV   2026-08-24 20:42   F CFA 5,000
SALE4S6XMOHKF0KUF13   2026-08-24 17:14   F CFA 2,000
```

`UNSPECIFIED_FAILURE` gives the customer no reason at all. The message they see is
*"The payment could not be completed. Please choose another payment method or try again."* —
but Orange Money is the dominant wallet in Guinea, so there is no other method for them to choose.

### Burkina Faso — Orange Money: 0 successes out of 30 attempts

| | |
|---|---|
| Attempts with Orange Money | 30 |
| Successful | **0** |
| Dominant error | `GENERAL_ERROR` — **29 of 30** |
| Insufficient balance | **0** |

```
SALEO7ZR1ZWAI57PUKO   2026-08-26 15:15   GENERAL_ERROR   F CFA 2,000
SALEYIOCT7UZ30Q2TTG   2026-08-26 10:51   GENERAL_ERROR   F CFA 2,000
SALE6Z3AUGVSBKPGNTR   2026-08-26 10:41   GENERAL_ERROR   F CFA 2,000
SALENTCSBLRBEERUDCG   2026-08-25 23:52   GENERAL_ERROR   F CFA 15,000
```

Note the last one: a 15,000 FCFA annual subscription lost to a generic error.

### Mali — Amanata and Orange Money: `GATEWAY_INTERNAL_ERROR`

| | |
|---|---|
| Total attempts | 44 |
| Failed | 10 |
| Dominant error | `GATEWAY_INTERNAL_ERROR` — **8 of 10** |
| Insufficient balance | **0** |

```
SALER825J4IWDAL6761   2026-08-26 17:17   Amanata        GATEWAY_INTERNAL_ERROR   F CFA 2,000
SALE15TNF21TOWLBTML   2026-08-26 17:11   Amanata        GATEWAY_INTERNAL_ERROR   F CFA 5,000
SALECUUNRN6BPKC72RD   2026-08-26 15:55   Orange Money   GATEWAY_INTERNAL_ERROR   F CFA 2,000
SALEZL9PP5VIT4CHQXD   2026-08-26 15:45   Orange Money   GATEWAY_INTERNAL_ERROR   F CFA 2,000
SALES6K5347DFW6U5RC   2026-08-26 14:49   Amanata        GATEWAY_INTERNAL_ERROR   F CFA 5,000
```

One customer (`tenereamachakoul@gmail.com`) attempted **nine times** before giving up.
`GATEWAY_INTERNAL_ERROR` is by definition a fault on the provider side, not the customer's.

### Togo — Mixx by Yas: `GENERAL_ERROR`

| | |
|---|---|
| Mixx by Yas attempts observed | 13 |
| Failed | 10 |
| Dominant error | `GENERAL_ERROR` — 8 |
| Insufficient balance | **0** |

```
SALEAQVDX8VTNMC5M99   2026-08-26 10:52   Mixx by Yas   GENERAL_ERROR   F CFA 15,000
SALEYVQNYN2CFGREXU8   2026-08-25 12:42   Mixx by Yas   GENERAL_ERROR   F CFA 5,000
SALE4F2CZY9V1T45YQJ   2026-08-24 22:30   Mixx by Yas   GENERAL_ERROR   F CFA 2,000
```

---

## Why we believe this is a gateway issue, not customer behaviour

The comparison with countries where the store performs normally is unambiguous:

| Country | Success rate | Top failure cause | Share that is insufficient balance |
|---|---|---|---|
| Côte d'Ivoire | 66.5 % | `INSUFFICIENT_BALANCE` | **85.6 %** |
| Cameroon | 45.5 % | `INSUFFICIENT_BALANCE` | **88.9 %** |
| Benin | 52.9 % | `INSUFFICIENT_BALANCE` | 68.8 % |
| **Burkina Faso** | 45.7 % | `GENERAL_ERROR` (92 %) | **0 %** |
| **Togo** | 39 % | `GENERAL_ERROR` (52 %) | **0 %** |
| **Mali** | **16.7 %** | `GATEWAY_INTERNAL_ERROR` (80 %) | **0 %** |
| **Guinea** | **16.4 %** | `UNSPECIFIED_FAILURE` (96 %) | **0 %** |

Same store, same products, same prices, same checkout, same period.
Where the gateway works, customers fail for lack of funds. Where it does not, they fail for reasons no one can act on.

---

## What we are asking

1. **Check the Orange Money integration for Guinea and Burkina Faso.** A 1-in-48 and a 0-in-30 success rate on the country's primary wallet is not a customer problem.
2. **Check the Amanata and Orange Money integration for Mali** — `GATEWAY_INTERNAL_ERROR` is an internal fault code.
3. **Tell us what `UNSPECIFIED_FAILURE` and `GENERAL_ERROR` actually mean.** With 118 and 50 occurrences respectively, these two codes cover 44 % of all our failures and give neither us nor the customer anything to act on.
4. **Confirm whether these transactions were ever presented to the operator**, or rejected before reaching them.

## Business impact

Approximately **129 failed payments** in these four countries over the period, from customers with sufficient funds — between **300,000 and 500,000 FCFA** in lost subscriptions, not counting those who never retried.

Conversion in Guinea is **6.7 %** against **17 %** in countries where the gateway works. That gap is the measure of the problem.

---

**Contact:** Profoot — profootai.com
We can provide the full dataset of 384 analysed failures on request.
