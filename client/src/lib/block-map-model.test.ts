import assert from "node:assert/strict";
import test from "node:test";
import {
  blockToCoordinate,
  blockToTimelineX,
  coordinateToBlock,
  createBlockHeights,
  getBlockCount,
} from "./block-map-model";

test("an inclusive range contains every block exactly once", () => {
  const startBlock = 1_100_000;
  const endBlock = 1_101_000;
  const heights = createBlockHeights(startBlock, endBlock);

  assert.equal(getBlockCount(startBlock, endBlock), 1_001);
  assert.equal(heights.length, 1_001);
  assert.equal(heights[0], startBlock);
  assert.equal(heights.at(-1), endBlock);
  assert.equal(new Set(heights).size, 1_001);

  heights.forEach((blockHeight, index) => {
    assert.equal(blockHeight, startBlock + index);
  });
});

test("every block maps to one reversible coordinate at maximum zoom", () => {
  const startBlock = 1_100_000;
  const endBlock = 1_101_000;
  const seenCoordinates = new Set<string>();

  for (const blockHeight of createBlockHeights(startBlock, endBlock)) {
    const coordinate = blockToCoordinate(blockHeight, startBlock);
    const key = `${coordinate.row}:${coordinate.column}`;
    assert.equal(seenCoordinates.has(key), false);
    seenCoordinates.add(key);
    assert.equal(
      coordinateToBlock(coordinate.row, coordinate.column, startBlock, endBlock),
      blockHeight,
    );
  }

  assert.equal(seenCoordinates.size, 1_001);
});

test("zoom changes pixels, never the identity at a grid coordinate", () => {
  const startBlock = 1_100_000;
  const endBlock = 1_101_000;
  const blockHeight = 1_100_731;
  const coordinate = blockToCoordinate(blockHeight, startBlock);

  for (const zoom of [0.55, 1, 1.5, 2]) {
    const cellSize = 9 * zoom;
    const pixelX = coordinate.column * cellSize;
    const pixelY = coordinate.row * cellSize;
    const clickedColumn = Math.floor(pixelX / cellSize);
    const clickedRow = Math.floor(pixelY / cellSize);
    assert.equal(
      coordinateToBlock(clickedRow, clickedColumn, startBlock, endBlock),
      blockHeight,
    );
  }
});

test("timeline x preserves pre-range NOW and moves monotonically", () => {
  const startBlock = 1_200_000;
  const blocksPerColumn = 4_000;
  const cellSize = 9;
  const beforeRange = blockToTimelineX(1_100_000, startBlock, blocksPerColumn, cellSize);
  const atStart = blockToTimelineX(startBlock, startBlock, blocksPerColumn, cellSize);
  const later = blockToTimelineX(startBlock + 10_000, startBlock, blocksPerColumn, cellSize);

  assert.ok(beforeRange < 0);
  assert.ok(atStart > beforeRange);
  assert.ok(later > atStart);
});