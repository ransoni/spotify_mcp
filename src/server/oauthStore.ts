import { randomBytes, createHash } from "node:crypto";
import type { OAuthClientInformationFull } from "@modelcontextprotocol/sdk/shared/auth.js";
import { getFirestore } from "./firestore.js";

const AUTH_CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const ACCESS_TOKEN_TTL_SECONDS = 60 * 60; // 1 hour
const REFRESH_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

const CLIENTS_COLLECTION = "oauth_clients";
const CODES_COLLECTION = "oauth_codes";
const TOKENS_COLLECTION = "oauth_tokens";
const REFRESH_TOKENS_COLLECTION = "oauth_refresh_tokens";

export interface AuthorizationCodeRecord {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  scopes: string[];
  resource?: string;
  expiresAt: number;
}

export interface IssuedTokenRecord {
  clientId: string;
  scopes: string[];
  resource?: string;
  expiresAt: number;
}

export interface IssuedRefreshTokenRecord {
  clientId: string;
  scopes: string[];
  resource?: string;
  expiresAt: number;
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function opaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function getClient(clientId: string): Promise<OAuthClientInformationFull | undefined> {
  const snap = await getFirestore().collection(CLIENTS_COLLECTION).doc(clientId).get();
  return snap.exists ? (snap.data() as OAuthClientInformationFull) : undefined;
}

export async function registerClient(
  client: OAuthClientInformationFull,
): Promise<OAuthClientInformationFull> {
  await getFirestore().collection(CLIENTS_COLLECTION).doc(client.client_id).set(client);
  return client;
}

export async function createAuthorizationCode(
  record: Omit<AuthorizationCodeRecord, "expiresAt">,
): Promise<string> {
  const code = opaqueToken();
  const data: AuthorizationCodeRecord = { ...record, expiresAt: Date.now() + AUTH_CODE_TTL_MS };
  await getFirestore().collection(CODES_COLLECTION).doc(code).set(data);
  return code;
}

export async function getAuthorizationCode(code: string): Promise<AuthorizationCodeRecord | null> {
  const doc = getFirestore().collection(CODES_COLLECTION).doc(code);
  const snap = await doc.get();
  if (!snap.exists) return null;
  const record = snap.data() as AuthorizationCodeRecord;
  if (record.expiresAt < Date.now()) {
    await doc.delete();
    return null;
  }
  return record;
}

export async function consumeAuthorizationCode(code: string): Promise<AuthorizationCodeRecord | null> {
  const record = await getAuthorizationCode(code);
  if (!record) return null;
  await getFirestore().collection(CODES_COLLECTION).doc(code).delete();
  return record;
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export async function issueTokens(params: {
  clientId: string;
  scopes: string[];
  resource?: string;
}): Promise<IssuedTokens> {
  const accessToken = opaqueToken();
  const refreshToken = opaqueToken();
  const now = Date.now();

  const db = getFirestore();
  await Promise.all([
    db
      .collection(TOKENS_COLLECTION)
      .doc(sha256Hex(accessToken))
      .set({
        clientId: params.clientId,
        scopes: params.scopes,
        resource: params.resource,
        expiresAt: now + ACCESS_TOKEN_TTL_SECONDS * 1000,
      } satisfies IssuedTokenRecord),
    db
      .collection(REFRESH_TOKENS_COLLECTION)
      .doc(sha256Hex(refreshToken))
      .set({
        clientId: params.clientId,
        scopes: params.scopes,
        resource: params.resource,
        expiresAt: now + REFRESH_TOKEN_TTL_MS,
      } satisfies IssuedRefreshTokenRecord),
  ]);

  return { accessToken, refreshToken, expiresIn: ACCESS_TOKEN_TTL_SECONDS };
}

export async function verifyAccessToken(token: string): Promise<IssuedTokenRecord | null> {
  const snap = await getFirestore().collection(TOKENS_COLLECTION).doc(sha256Hex(token)).get();
  if (!snap.exists) return null;
  const record = snap.data() as IssuedTokenRecord;
  if (record.expiresAt < Date.now()) return null;
  return record;
}

export async function consumeRefreshToken(token: string): Promise<IssuedRefreshTokenRecord | null> {
  const doc = getFirestore().collection(REFRESH_TOKENS_COLLECTION).doc(sha256Hex(token));
  const snap = await doc.get();
  if (!snap.exists) return null;
  const record = snap.data() as IssuedRefreshTokenRecord;
  await doc.delete();
  if (record.expiresAt < Date.now()) return null;
  return record;
}

export async function revokeToken(token: string): Promise<void> {
  const db = getFirestore();
  await Promise.all([
    db.collection(TOKENS_COLLECTION).doc(sha256Hex(token)).delete(),
    db.collection(REFRESH_TOKENS_COLLECTION).doc(sha256Hex(token)).delete(),
  ]);
}
