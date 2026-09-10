export type BitcoinModelStats = {
  currentBlock: number;
  currentTimestamp: number;
  medianInterval: number;
  meanInterval: number;
  standardDeviation: number;
  robustInterval: number;
  epochAverageInterval: number;
  epochIntervalStdDev: number;
  sampleSize: number;
  rollingAverages: Array<{ blocks: number; mean: number }>;
  difficulty: number;
  epochRemaining: number;
  nextAdjustment: number;
  nextAdjustmentTimestamp: number;
  updatedAt: number;
};

export type BlockEstimate = {
  block: number;
  median: Date;
  p25: Date;
  p75: Date;
  p10: Date;
  p90: Date;
};

export function isBitcoinModelStats(value: unknown): value is BitcoinModelStats {
  if (!value || typeof value !== "object") return false;
  const model = value as Partial<BitcoinModelStats>;
  return [
    model.currentBlock,
    model.currentTimestamp,
    model.medianInterval,
    model.meanInterval,
    model.standardDeviation,
    model.robustInterval,
    model.epochAverageInterval,
    model.epochIntervalStdDev,
    model.sampleSize,
    model.difficulty,
    model.epochRemaining,
    model.nextAdjustment,
    model.nextAdjustmentTimestamp,
    model.updatedAt,
  ].every((field) => typeof field === "number" && Number.isFinite(field))
    && Array.isArray(model.rollingAverages);
}

const EPOCH = 2016;
const TARGET = 600;
const Z25 = 0.67448975;
const Z90 = 1.28155157;

function forecastMoments(stats: BitcoinModelStats, distance: number) {
  if (distance <= 0) return 0;
  let remaining = distance;
  let elapsed = 0;
  let variance = 0;
  let epoch = 0;
  const observedRate = stats.epochAverageInterval * 0.7 + stats.meanInterval * 0.2 + stats.robustInterval * 0.1;
  while (remaining > 0) {
    const epochCapacity = epoch === 0 ? Math.max(1, stats.epochRemaining) : EPOCH;
    const count = Math.min(epochCapacity, remaining);
    // Current-epoch conditions persist until retarget; later epochs mean-revert.
    const mean = epoch === 0 ? observedRate : TARGET + (observedRate - TARGET) * Math.exp(-epoch * 1.4);
    elapsed += count * mean;
    // The current partial epoch uses observed block-level variance. Each later
    // epoch contributes an independent mean-rate variance calibrated from
    // historical difficulty epochs, so uncertainty combines by variance rather
    // than compounding linearly.
    variance += epoch === 0
      ? count * stats.standardDeviation ** 2
      : count ** 2 * stats.epochIntervalStdDev ** 2;
    remaining -= count;
    epoch += 1;
  }
  return { mean: elapsed, standardDeviation: Math.sqrt(variance) };
}

function quantileSeconds(stats: BitcoinModelStats, distance: number, z: number) {
  const moments = forecastMoments(stats, distance);
  if (moments === 0) return 0;
  return Math.max(0, moments.mean + z * moments.standardDeviation);
}

export function estimateBlock(stats: BitcoinModelStats, block: number): BlockEstimate {
  const target = Math.max(stats.currentBlock, Math.round(block));
  const distance = target - stats.currentBlock;
  const origin = stats.currentTimestamp * 1000;
  const at = (z: number) => new Date(origin + quantileSeconds(stats, distance, z) * 1000);
  return { block: target, median: at(0), p25: at(-Z25), p75: at(Z25), p10: at(-Z90), p90: at(Z90) };
}

/** Approximate inverse of the median model, intentionally deterministic. */
export function dateToBlock(stats: BitcoinModelStats, date: Date): number {
  const seconds = Math.max(0, (date.getTime() - stats.currentTimestamp * 1000) / 1000);
  let low = stats.currentBlock;
  let high = low + Math.max(1, Math.ceil(seconds / 240) + 100);
  while (quantileSeconds(stats, high - low, 0) < seconds) high = low + (high - low) * 2;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (quantileSeconds(stats, mid - stats.currentBlock, 0) < seconds) low = mid + 1;
    else high = mid;
  }
  return low;
}

export function modelFromFallback(now = Date.now()): BitcoinModelStats {
  return {
    currentBlock: 914_280, currentTimestamp: Math.floor(now / 1000),
    medianInterval: TARGET, meanInterval: TARGET, standardDeviation: 75,
    robustInterval: TARGET, epochAverageInterval: TARGET, sampleSize: 0,
    epochIntervalStdDev: 30,
    rollingAverages: [], difficulty: 0, epochRemaining: EPOCH,
    nextAdjustment: 916_272, nextAdjustmentTimestamp: now + EPOCH * TARGET * 1000, updatedAt: now,
  };
}