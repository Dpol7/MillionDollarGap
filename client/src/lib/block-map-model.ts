export type BlockStatus = "available" | "claimed" | "past";

export type BlockIdentity = {
  blockHeight: number;
  status: BlockStatus;
  userId?: string;
  estimatedTime: string;
  predictionDensity: number;
};

export type BlockCoordinate = {
  index: number;
  column: number;
  row: number;
};

export const DEFAULT_BLOCKS_PER_ROW = 1280;

export function getBlockCount(startBlock: number, endBlock: number) {
  if (!Number.isInteger(startBlock) || !Number.isInteger(endBlock) || endBlock < startBlock) {
    throw new Error("Invalid inclusive block range");
  }
  return endBlock - startBlock + 1;
}

export function createBlockHeights(startBlock: number, endBlock: number) {
  const count = getBlockCount(startBlock, endBlock);
  return Array.from({ length: count }, (_, index) => startBlock + index);
}

export function blockToCoordinate(
  blockHeight: number,
  startBlock: number,
  blocksPerRow = DEFAULT_BLOCKS_PER_ROW,
): BlockCoordinate {
  if (!Number.isInteger(blockHeight) || blockHeight < startBlock) {
    throw new Error("Block height is outside the map range");
  }
  if (!Number.isInteger(blocksPerRow) || blocksPerRow <= 0) {
    throw new Error("blocksPerRow must be a positive integer");
  }

  const index = blockHeight - startBlock;
  return {
    index,
    column: index % blocksPerRow,
    row: Math.floor(index / blocksPerRow),
  };
}

export function coordinateToBlock(
  row: number,
  column: number,
  startBlock: number,
  endBlock: number,
  blocksPerRow = DEFAULT_BLOCKS_PER_ROW,
) {
  if (!Number.isInteger(row) || !Number.isInteger(column) || row < 0 || column < 0 || column >= blocksPerRow) {
    return null;
  }
  const blockHeight = startBlock + row * blocksPerRow + column;
  return blockHeight <= endBlock ? blockHeight : null;
}

export function getGridDimensions(startBlock: number, endBlock: number, blocksPerRow = DEFAULT_BLOCKS_PER_ROW) {
  const count = getBlockCount(startBlock, endBlock);
  return {
    columns: blocksPerRow,
    rows: Math.ceil(count / blocksPerRow),
    count,
  };
}

export function getContiguousRowRange(
  row: number,
  startBlock: number,
  endBlock: number,
  blocksPerRow = DEFAULT_BLOCKS_PER_ROW,
) {
  const first = coordinateToBlock(row, 0, startBlock, endBlock, blocksPerRow);
  if (first === null) return null;
  return {
    startBlock: first,
    endBlock: Math.min(endBlock, first + blocksPerRow - 1),
  };
}