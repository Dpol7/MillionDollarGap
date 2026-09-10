import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import express, { type Request } from "express";
import type { AddressInfo } from "node:net";
import pg from "pg";
import { createPredictionLockHandler } from "./routes";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const testPrefix = `concurrency-test-${process.pid}-${Date.now()}`;
const createdUsers: string[] = [];
let server: ReturnType<ReturnType<typeof express>["listen"]>;
let baseUrl: string;

const prediction = (blockHeight: number) => ({
  blockHeight,
  estimatedArrival: "2030-01-01",
  fiftyRange: "2029-12-01 to 2030-02-01",
  eightyRange: "2029-06-01 to 2030-06-01",
});

async function requestLock(userId: string, blockHeight: number) {
  const response = await fetch(`${baseUrl}/api/prediction/lock`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-test-user-id": userId,
    },
    body: JSON.stringify(prediction(blockHeight)),
  });
  return { status: response.status, body: await response.json() as Record<string, unknown> };
}

function nextUser(label: string) {
  const userId = `${testPrefix}-${label}`;
  createdUsers.push(userId);
  return userId;
}

before(async () => {
  const app = express();
  app.use(express.json());
  app.post(
    "/api/prediction/lock",
    createPredictionLockHandler(undefined, (req: Request) => ({
      userId: req.header("x-test-user-id") ?? null,
    })),
  );
  app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ message: error.message });
  });
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  await pool.query(
    `DELETE FROM block_locks
     WHERE account_id IN (SELECT id FROM prediction_accounts WHERE clerk_user_id = ANY($1))`,
    [createdUsers],
  );
  await pool.query("DELETE FROM prediction_accounts WHERE clerk_user_id = ANY($1)", [createdUsers]);
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  await pool.end();
});

test("simultaneous users cannot both permanently lock the same block", async () => {
  const blockHeight = 1_400_000 + Math.floor(Math.random() * 10_000);
  const results = await Promise.all([
    requestLock(nextUser("same-block-a"), blockHeight),
    requestLock(nextUser("same-block-b"), blockHeight),
  ]);

  assert.deepEqual(results.map(result => result.status).sort(), [201, 409]);
  assert.match(String(results.find(result => result.status === 409)?.body.message), /already|claimed/i);

  const databaseResult = await pool.query(
    "SELECT count(*)::int AS count FROM block_locks WHERE block_height = $1",
    [blockHeight],
  );
  assert.equal(databaseResult.rows[0].count, 1);
});

test("simultaneous requests from one account cannot create two predictions", async () => {
  const userId = nextUser("same-account");
  const firstBlock = 1_420_000 + Math.floor(Math.random() * 10_000);
  const results = await Promise.all([
    requestLock(userId, firstBlock),
    requestLock(userId, firstBlock + 20_000),
  ]);

  assert.deepEqual(results.map(result => result.status).sort(), [201, 409]);
  const conflict = results.find(result => result.status === 409);
  assert.match(String(conflict?.body.message), /already permanently locked/i);
  assert.ok(conflict?.body.prediction);

  const databaseResult = await pool.query(
    `SELECT count(*)::int AS count
     FROM block_locks
     WHERE account_id = (SELECT id FROM prediction_accounts WHERE clerk_user_id = $1)`,
    [userId],
  );
  assert.equal(databaseResult.rows[0].count, 1);
});