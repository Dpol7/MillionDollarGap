import assert from "node:assert/strict";
import test from "node:test";
import { dateToBlock, estimateBlock, isBitcoinModelStats, modelFromFallback } from "./block-estimator";

const stats = modelFromFallback(1_700_000_000_000);

test("deterministic ordered quantiles across forecast horizons", () => {
  let previous = stats.currentTimestamp * 1000;
  let previousWidth = 0;
  for (const distance of [10, 100, 1_000, 10_000, 50_000, 100_000, 250_000, 500_000]) {
    const a = estimateBlock(stats, stats.currentBlock + distance);
    const b = estimateBlock(stats, stats.currentBlock + distance);
    assert.deepEqual(a, b);
    assert.ok(a.p10 <= a.p25 && a.p25 <= a.median && a.median <= a.p75 && a.p75 <= a.p90);
    assert.ok(a.median.getTime() > previous);
    const width = a.p90.getTime() - a.p10.getTime();
    assert.ok(width >= previousWidth);
    // Even the far horizon remains a bounded calendar uncertainty.
    assert.ok(width < 400 * 86_400_000);
    previous = a.median.getTime();
    previousWidth = width;
  }
});

test("median date conversion is reversible within one block", () => {
  for (const distance of [10, 100, 1_000, 10_000, 50_000, 100_000, 250_000, 500_000]) {
    const estimate = estimateBlock(stats, stats.currentBlock + distance);
    const inverse = dateToBlock(stats, estimate.median);
    assert.ok(Math.abs(inverse - (stats.currentBlock + distance)) <= 1);
  }
});

test("rejects cached models from before epoch variance calibration", () => {
  const legacy = { ...stats } as Record<string, unknown>;
  delete legacy.epochIntervalStdDev;
  assert.equal(isBitcoinModelStats(legacy), false);
  assert.equal(isBitcoinModelStats(stats), true);
});