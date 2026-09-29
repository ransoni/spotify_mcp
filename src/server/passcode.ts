import { timingSafeEqual } from "node:crypto";
import { GCP_PROJECT_ID, MCP_OWNER_PASSCODE_SECRET_NAME } from "../config.js";

let cachedPasscode: Promise<string> | undefined;

async function fetchPasscode(): Promise<string> {
  if (!GCP_PROJECT_ID) {
    throw new Error("GOOGLE_CLOUD_PROJECT must be set to read the owner passcode from Secret Manager.");
  }
  const { SecretManagerServiceClient } = await import("@google-cloud/secret-manager");
  const client = new SecretManagerServiceClient();
  const name = `projects/${GCP_PROJECT_ID}/secrets/${MCP_OWNER_PASSCODE_SECRET_NAME}/versions/latest`;
  const [version] = await client.accessSecretVersion({ name });
  const data = version.payload?.data;
  if (!data) {
    throw new Error(`Secret ${MCP_OWNER_PASSCODE_SECRET_NAME} has no accessible version.`);
  }
  return data.toString().trim();
}

export async function verifyOwnerPasscode(candidate: string): Promise<boolean> {
  cachedPasscode ??= fetchPasscode();
  let expected: string;
  try {
    expected = await cachedPasscode;
  } catch (err) {
    // Don't leave a permanently-rejected promise cached — a transient Secret
    // Manager failure shouldn't lock out the owner until the process restarts.
    cachedPasscode = undefined;
    throw err;
  }

  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  // timingSafeEqual requires equal-length buffers; pad the shorter one so a length
  // mismatch doesn't leak via an early throw (this still fails the comparison).
  const length = Math.max(a.length, b.length, 1);
  const aPadded = Buffer.concat([a], length);
  const bPadded = Buffer.concat([b], length);
  return a.length === b.length && timingSafeEqual(aPadded, bPadded);
}
