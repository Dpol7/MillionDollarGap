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

export const DEFAULT_BLOCKS_PER_COLUMN = 48;

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
  blocksPerColumn = DEFAULT_BLOCKS_PER_COLUMN,
): BlockCoordinate {
  if (!Number.isInteger(blockHeight) || blockHeight < startBlock) {
    throw new Error("Block height is outside the map range");
  }
  if (!Number.isInteger(blocksPerColumn) || blocksPerColumn <= 0) {
    throw new Error("blocksPerColumn must be a positive integer");
  }

  const index = blockHeight - startBlock;
  return {
    index,
    column: Math.floor(index / blocksPerColumn),
    row: index % blocksPerColumn,
  };
}

export function coordinateToBlock(
  row: number,
  column: number,
  startBlock: number,
  endBlock: number,
  blocksPerColumn = DEFAULT_BLOCKS_PER_COLUMN,
) {
  if (!Number.isInteger(row) || !Number.isInteger(column) || row < 0 || column < 0 || row >= blocksPerColumn) {
    return null;
  }
  const blockHeight = startBlock + column * blocksPerColumn + row;
  return blockHeight <= endBlock ? blockHeight : null;
}

export function getGridDimensions(startBlock: number, endBlock: number, blocksPerColumn = DEFAULT_BLOCKS_PER_COLUMN) {
  const count = getBlockCount(startBlock, endBlock);
  return {
    columns: Math.ceil(count / blocksPerColumn),
    rows: blocksPerColumn,
    count,
  };
}

export function blockToTimelineX(
  blockHeight: number,
  startBlock: number,
  blocksPerColumn: number,
  cellSize: number,
  panX = 0,
) {
  if (blocksPerColumn <= 0 || cellSize <= 0) {
    throw new Error("Timeline dimensions must be positive");
  }
  return panX + ((blockHeight - startBlock) / blocksPerColumn) * cellSize + cellSize / 2;
}

export function getContiguousColumnRange(
  column: number,
  startBlock: number,
  endBlock: number,
  blocksPerColumn = DEFAULT_BLOCKS_PER_COLUMN,
) {
  const first = coordinateToBlock(0, column, startBlock, endBlock, blocksPerColumn);
  if (first === null) return null;
  return {
    startBlock: first,
    endBlock: Math.min(endBlock, first + blocksPerColumn - 1),
  };
}