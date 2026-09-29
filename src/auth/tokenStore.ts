import { mkdirSync, writeFileSync, readFileSync, chmodSync, existsSync } from "node:fs";
import { CONFIG_DIR, TOKENS_PATH, GCP_PROJECT_ID, SPOTIFY_TOKENS_SECRET_NAME } from "../config.js";

export interface TokenData {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  scope: string;
  token_type: string;
}

interface TokenBackend {
  hasTokens(): Promise<boolean> | boolean;
  readTokens(): Promise<TokenData | null> | TokenData | null;
  writeTokens(tokens: TokenData): Promise<void> | void;
}

const fileBackend: TokenBackend = {
  hasTokens() {
    return existsSync(TOKENS_PATH);
  },
  readTokens() {
    if (!existsSync(TOKENS_PATH)) return null;
    const raw = readFileSync(TOKENS_PATH, "utf-8");
    return JSON.parse(raw) as TokenData;
  },
  writeTokens(tokens) {
    mkdirSync(CONFIG_DIR, { recursive: true });
    writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2), { mode: 0o600 });
    chmodSync(TOKENS_PATH, 0o600);
  },
};

function createSecretManagerBackend(projectId: string): TokenBackend {
  // Imported lazily so the fs-only path (local stdio usage) never needs this
  // package installed/reachable.
  const secretsPromise = import("@google-cloud/secret-manager").then(
    ({ SecretManagerServiceClient }) => new SecretManagerServiceClient(),
  );
  const secretName = `projects/${projectId}/secrets/${SPOTIFY_TOKENS_SECRET_NAME}`;

  return {
    async hasTokens() {
      return (await this.readTokens()) !== null;
    },
    async readTokens() {
      const client = await secretsPromise;
      try {
        const [version] = await client.accessSecretVersion({ name: `${secretName}/versions/latest` });
        const data = version.payload?.data;
        if (!data) return null;
        return JSON.parse(data.toString()) as TokenData;
      } catch (err) {
        if (isNotFoundError(err)) return null;
        throw err;
      }
    },
    async writeTokens(tokens) {
      const client = await secretsPromise;
      await client.addSecretVersion({
        parent: secretName,
        payload: { data: Buffer.from(JSON.stringify(tokens)) },
      });
    },
  };
}

function isNotFoundError(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code: unknown }).code === 5;
}

const backend: TokenBackend = GCP_PROJECT_ID ? createSecretManagerBackend(GCP_PROJECT_ID) : fileBackend;

export async function hasTokens(): Promise<boolean> {
  return backend.hasTokens();
}

export async function readTokens(): Promise<TokenData | null> {
  return backend.readTokens();
}

export async function writeTokens(tokens: TokenData): Promise<void> {
  await backend.writeTokens(tokens);
}
