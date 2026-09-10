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

type MempoolBlock = { height: number; timestamp: number; difficulty?: number };
type DifficultyAdjustment = {
  remainingBlocks: number;
  estimatedRetargetDate: number;
  timeAvg: number;
  adjustedTimeAvg: number;
};
type DifficultyHistoryRow = [timestamp: number, height: number, difficulty: number, change: number];
const API = "https://mempool.space/api";
const SIX_HOURS = 6 * 60 * 60 * 1000;
const EPOCH = 2016;
const BLOCK_PAGE_SIZE = 10;
const MAX_BLOCK_REQUESTS_IN_FLIGHT = 8;
let cached: BitcoinModelStats | null = null;
let cachedAt = 0;
let tipCache: { height: number; timestamp: number; difficulty: number } | null = null;
let tipAt = 0;

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API}${path}`, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`Mempool API ${path} returned ${response.status}`);
  return response.json() as Promise<T>;
}

async function getText(path: string): Promise<string> {
  const response = await fetch(`${API}${path}`, { headers: { accept: "text/plain" } });
  if (!response.ok) throw new Error(`Mempool API ${path} returned ${response.status}`);
  return (await response.text()).trim();
}

async function getTip() {
  if (tipCache && Date.now() - tipAt < 30_000) return tipCache;
  const height = Number(await getText("/blocks/tip/height"));
  if (!Number.isInteger(height) || height <= 0) throw new Error("Mempool API returned an invalid tip height");
  const hash = await getText(`/block-height/${height}`);
  const block = await getJson<MempoolBlock>(`/block/${hash}`);
  tipCache = { height, timestamp: block.timestamp, difficulty: block.difficulty || 0 };
  tipAt = Date.now();
  return tipCache;
}

async function getRecentBlocks(tipHeight: number, sampleBlocks: number) {
  const first = Math.max(0, tipHeight - sampleBlocks + 1);
  const heights = Array.from(
    { length: Math.ceil(sampleBlocks / BLOCK_PAGE_SIZE) },
    (_, i) => tipHeight - i * BLOCK_PAGE_SIZE,
  );
  const batches: MempoolBlock[][] = [];
  for (let i = 0; i < heights.length; i += MAX_BLOCK_REQUESTS_IN_FLIGHT) {
    const group = heights.slice(i, i + MAX_BLOCK_REQUESTS_IN_FLIGHT);
    batches.push(...await Promise.all(group.map((height) =>
      getJson<MempoolBlock[]>(`/v1/blocks/${height}`))));
  }

  const uniqueByHeight = new Map<number, MempoolBlock>();
  for (const block of batches.flat()) {
    if (block.height < first || block.height > tipHeight) continue;
    uniqueByHeight.set(block.height, block);
  }
  const blocks = Array.from(uniqueByHeight.values()).sort((a, b) => a.height - b.height);
  if (blocks.length !== sampleBlocks) {
    throw new Error(`Mempool API returned ${blocks.length} of ${sampleBlocks} contiguous blocks`);
  }
  for (let i = 1; i < blocks.length; i += 1) {
    if (blocks[i].height !== blocks[i - 1].height + 1) {
      throw new Error("Mempool API returned a non-contiguous block sample");
    }
  }
  return blocks;
}

export async function getBitcoinModelStats(): Promise<BitcoinModelStats> {
  const tip = await getTip();
  if (cached && Date.now() - cachedAt < SIX_HOURS) {
    const epochRemaining = EPOCH - (tip.height % EPOCH);
    return {
      ...cached,
      currentBlock: tip.height,
      currentTimestamp: tip.timestamp,
      difficulty: tip.difficulty,
      epochRemaining,
      nextAdjustment: tip.height + epochRemaining,
      nextAdjustmentTimestamp: tip.timestamp * 1000 + epochRemaining * cached.epochAverageInterval * 1000,
      updatedAt: cached.updatedAt,
    };
  }

  const sampleBlocks = EPOCH;
  const [difficultyState, difficultyHistory, blocks] = await Promise.all([
    getJson<DifficultyAdjustment>("/v1/difficulty-adjustment"),
    getJson<DifficultyHistoryRow[]>("/v1/mining/difficulty-adjustments/3y"),
    getRecentBlocks(tip.height, sampleBlocks),
  ]);
  const allIntervals = blocks.slice(1).flatMap((block, i) => {
    const previous = blocks[i];
    const seconds = block.timestamp - previous.timestamp;
    return seconds > 0 ? [seconds] : [];
  });
  if (allIntervals.length !== sampleBlocks - 1) {
    throw new Error("Mempool API returned invalid chronological block timestamps");
  }
  const intervals = allIntervals.filter((seconds) => seconds < 6 * 60 * 60);
  if (intervals.length < sampleBlocks * 0.9) throw new Error("Mempool API returned too few usable block intervals");
  const ordered = [...intervals].sort((a, b) => a - b);
  const mean = intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
  const median = ordered[Math.floor(ordered.length / 2)];
  const standardDeviation = Math.sqrt(intervals.reduce((sum, value) => sum + (value - mean) ** 2, 0) / intervals.length);
  const trim = Math.floor(ordered.length * 0.1);
  const trimmed = ordered.slice(trim, ordered.length - trim);
  const robustInterval = trimmed.reduce((sum, value) => sum + value, 0) / trimmed.length;
  const rollingAverages = [24, 144, intervals.length].map((count) => {
    const values = intervals.slice(-Math.min(count, intervals.length));
    return { blocks: count, mean: values.reduce((sum, value) => sum + value, 0) / values.length };
  });
  const orderedDifficultyHistory = [...difficultyHistory].sort((a, b) => a[1] - b[1]);
  const epochIntervals = orderedDifficultyHistory.slice(1)
    .flatMap((row, index) => {
      const previous = orderedDifficultyHistory[index];
      const blockDistance = row[1] - previous[1];
      const interval = (row[0] - previous[0]) / blockDistance;
      return blockDistance >= 1900 && blockDistance <= 2100 && interval > 300 && interval < 900 ? [interval] : [];
    });
  if (epochIntervals.length < 4) throw new Error("Mempool API returned too little difficulty history");
  const latestCompleteEpochInterval = epochIntervals[epochIntervals.length - 1];
  const epochIntervalMean = epochIntervals.reduce((sum, value) => sum + value, 0) / epochIntervals.length;
  const epochIntervalStdDev = Math.sqrt(
    epochIntervals.reduce((sum, value) => sum + (value - epochIntervalMean) ** 2, 0) / epochIntervals.length,
  );
  const epochRemaining = difficultyState.remainingBlocks || EPOCH - (tip.height % EPOCH);
  cached = {
    currentBlock: tip.height, currentTimestamp: tip.timestamp, medianInterval: median,
    meanInterval: mean, standardDeviation, robustInterval,
    // The latest complete difficulty epoch is the primary long-term rate.
    // The estimator applies the current rolling window only to the immediate
    // short-term forecast, then uses this observed epoch after retargeting.
    epochAverageInterval: latestCompleteEpochInterval,
    epochIntervalStdDev,
    sampleSize: intervals.length, rollingAverages, difficulty: tip.difficulty,
    epochRemaining, nextAdjustment: tip.height + epochRemaining,
    nextAdjustmentTimestamp: difficultyState.estimatedRetargetDate, updatedAt: Date.now(),
  };
  cachedAt = Date.now();
  return cached;
}