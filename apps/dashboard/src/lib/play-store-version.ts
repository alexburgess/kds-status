import { File } from "node:buffer";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

if (!("File" in globalThis)) {
  Object.defineProperty(globalThis, "File", {
    value: File,
    configurable: true
  });
}

const PACKAGE_NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/;
const SUCCESS_CACHE_MS = 6 * 60 * 60 * 1000;
const ERROR_CACHE_MS = 10 * 60 * 1000;
const DEFAULT_TIMEOUT_MS = 5000;

type PlayStoreAppLookup = (options: {
  appId: string;
  country: string;
  lang: string;
}) => Promise<{
  title?: string;
  version?: string;
  updated?: number;
}>;

interface GooglePlayScraperClient {
  app: PlayStoreAppLookup;
}

interface CacheEntry {
  expiresAt: number;
  result: PlayStoreVersionResult;
}

interface LookupOptions {
  lookupApp?: PlayStoreAppLookup;
  now?: number;
  cacheMs?: number;
  timeoutMs?: number;
}

export interface PlayStoreVersionResult {
  packageName?: string;
  version?: string;
  title?: string;
  updatedAt?: string;
  checkedAt: string;
  source: "play-store" | "not-configured";
  error?: string;
}

const versionCache = new Map<string, CacheEntry>();

export async function lookupPlayStoreVersion(
  packageName: string | null | undefined,
  options: LookupOptions = {}
): Promise<PlayStoreVersionResult> {
  const normalizedPackageName = packageName?.trim();
  const now = options.now ?? Date.now();
  const checkedAt = new Date(now).toISOString();

  if (!normalizedPackageName) {
    return {
      checkedAt,
      source: "not-configured"
    };
  }

  if (!PACKAGE_NAME_PATTERN.test(normalizedPackageName)) {
    return {
      packageName: normalizedPackageName,
      checkedAt,
      source: "play-store",
      error: "Invalid Android package name"
    };
  }

  const country = (process.env.PLAY_STORE_COUNTRY ?? "us").toLowerCase();
  const lang = (process.env.PLAY_STORE_LANGUAGE ?? "en").toLowerCase();
  const cacheKey = `${normalizedPackageName}:${country}:${lang}`;
  const cached = versionCache.get(cacheKey);

  if (!options.lookupApp && cached && cached.expiresAt > now) {
    return cached.result;
  }

  const lookupApp = options.lookupApp ?? getGooglePlayScraper().app;
  const result = await fetchPlayStoreVersion({
    packageName: normalizedPackageName,
    country,
    lang,
    checkedAt,
    lookupApp,
    timeoutMs: options.timeoutMs ?? envNumber("PLAY_STORE_LOOKUP_TIMEOUT_MS", DEFAULT_TIMEOUT_MS)
  });

  const cacheMs = options.cacheMs ?? (result.version ? SUCCESS_CACHE_MS : ERROR_CACHE_MS);
  versionCache.set(cacheKey, {
    result,
    expiresAt: now + cacheMs
  });

  return result;
}

export function clearPlayStoreVersionCache() {
  versionCache.clear();
}

function getGooglePlayScraper() {
  const scraperModule = require("google-play-scraper") as GooglePlayScraperClient & {
    default?: GooglePlayScraperClient;
  };

  return scraperModule.default ?? scraperModule;
}

async function fetchPlayStoreVersion({
  packageName,
  country,
  lang,
  checkedAt,
  lookupApp,
  timeoutMs
}: {
  packageName: string;
  country: string;
  lang: string;
  checkedAt: string;
  lookupApp: PlayStoreAppLookup;
  timeoutMs: number;
}): Promise<PlayStoreVersionResult> {
  try {
    const app = await withTimeout(lookupApp({ appId: packageName, country, lang }), timeoutMs);
    const version = normalizeVersion(app.version);

    if (!version) {
      return {
        packageName,
        title: app.title,
        checkedAt,
        source: "play-store",
        error: "Play Store listing did not expose a usable version"
      };
    }

    return {
      packageName,
      title: app.title,
      version,
      updatedAt: app.updated ? new Date(app.updated).toISOString() : undefined,
      checkedAt,
      source: "play-store"
    };
  } catch (error) {
    return {
      packageName,
      checkedAt,
      source: "play-store",
      error: error instanceof Error ? error.message : "Play Store lookup failed"
    };
  }
}

function normalizeVersion(version: string | undefined) {
  const trimmed = version?.trim();
  if (!trimmed || trimmed.toLowerCase().includes("varies with device")) {
    return undefined;
  }

  return trimmed;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("Play Store lookup timed out")), timeoutMs);
      })
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

function envNumber(name: string, fallback: number) {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
