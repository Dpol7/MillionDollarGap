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

export async function getBitcoinModelStats(): Promise<BitcoinModelStats> {
  const tip = await getTip();
  if (cached && Date.now() - cachedAt < SIX_HOURS) {
    const epochRemaining = 2016 - (tip.height % 2016);
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

  const sampleBlocks = 504;
  const first = Math.max(0, tip.height - sampleBlocks + 1);
  const [difficultyState, difficultyHistory, batches] = await Promise.all([
    getJson<DifficultyAdjustment>("/v1/difficulty-adjustment"),
    getJson<DifficultyHistoryRow[]>("/v1/mining/difficulty-adjustments/3y"),
    Promise.all(Array.from({ length: Math.ceil(sampleBlocks / 10) }, (_, i) =>
      getJson<MempoolBlock[]>(`/v1/blocks/${tip.height - i * 10}`))),
  ]);
  const uniqueByHeight = new Map<number, MempoolBlock>();
  for (const block of batches.flat()) {
    if (block.height >= first && block.height <= tip.height) uniqueByHeight.set(block.height, block);
  }
  const blocks = Array.from(uniqueByHeight.values()).sort((a, b) => a.height - b.height);
  const intervals = blocks.slice(1).flatMap((block, i) => {
    const previous = blocks[i];
    const seconds = block.timestamp - previous.timestamp;
    return block.height === previous.height + 1 && seconds > 0 && seconds < 6 * 60 * 60 ? [seconds] : [];
  });
  if (intervals.length < 100) throw new Error("Mempool API returned too few usable block intervals");
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
  const epochMean = epochIntervals.reduce((sum, value) => sum + value, 0) / epochIntervals.length;
  const epochIntervalStdDev = Math.sqrt(
    epochIntervals.reduce((sum, value) => sum + (value - epochMean) ** 2, 0) / epochIntervals.length,
  );
  const epochRemaining = difficultyState.remainingBlocks || 2016 - (tip.height % 2016);
  cached = {
    currentBlock: tip.height, currentTimestamp: tip.timestamp, medianInterval: median,
    meanInterval: mean, standardDeviation, robustInterval,
    epochAverageInterval: (difficultyState.adjustedTimeAvg || difficultyState.timeAvg) / 1000,
    epochIntervalStdDev,
    sampleSize: intervals.length, rollingAverages, difficulty: tip.difficulty,
    epochRemaining, nextAdjustment: tip.height + epochRemaining,
    nextAdjustmentTimestamp: difficultyState.estimatedRetargetDate, updatedAt: Date.now(),
  };
  cachedAt = Date.now();
  return cached;
}