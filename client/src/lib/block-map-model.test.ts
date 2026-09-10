import assert from "node:assert/strict";
import test from "node:test";
import {
  blockToCoordinate,
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