# Official resolution specification

## Status

Production policy approved September 10, 2026. The application may display demo feeds before commercial data access is available, but a demo feed must never determine the result.

## Official price authority

The official price authority is the **CME CF Bitcoin Real Time Index (BRTI)**. The production integration must use licensed real-time and historical BRTI data. Its provider, methodology version, entitlement, receipt timestamp, and source timestamp must be retained for every settlement-relevant observation.

## Threshold event

A threshold event occurs at the earliest BRTI timestamp for which the index is at or above **USD 1,000,000.00** continuously for **60 consecutive seconds**.

- Missing, stale, or invalid observations break continuity.
- The threshold is evaluated from recorded source timestamps, not browser clocks.
- No substitute feed may silently replace BRTI during a settlement window.
- If BRTI is unavailable, final outcome determination pauses until the required data is available and validated.

## Winning block

The winning block is the first canonical Bitcoin mainnet block observed after the confirmed threshold event.

Production observers must use independent Bitcoin Core nodes in separate failure domains. Each observation records node identity, receive timestamp, block hash, height, previous hash, and chainwork. A quorum policy and observer set are operational configuration, versioned and retained with settlement evidence.

The candidate result becomes final after 100 subsequent canonical mainnet confirmations. A reorganization before finality invalidates the candidate and the process continues on the canonical chain.

## Prediction invariant

A prediction is exactly one integer block height. It never changes after lock. The estimated calendar date is informational only and may change with a newer forecast. Each lock stores the forecast/model version that was displayed at lock time for auditability.

## Open product requirements

Before accepting real payments, complete commercial BRTI licensing, legal review for applicable contest and payment rules, an incident policy, public terms, and an independently reproducible settlement report.
