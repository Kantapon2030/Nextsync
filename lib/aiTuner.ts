// lib/aiTuner.ts
// Provides DB-backed settings retrieval with a 5-minute in-memory cache.
// Used by face search and pipeline routes to avoid repeated DB round-trips.

import { db, filterConfig } from "@/lib/db";
import { eq } from "drizzle-orm";

// ── In-memory cache ──────────────────────────────────────────────
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface SettingsCache {
  value: AISettings;
  cachedAt: number;
}

const settingsCache = new Map<string, SettingsCache>();
const CACHE_KEY = "ai_settings";

export interface AISettings {
  efSearch: number;
  cosineThreshold: number;
  maxResults: number;
  minFaceConfidence: number;
  blurMin: number;
  brightnessMin: number; // 0-1 float
  brightnessMax: number; // 0-1 float
}

const SETTING_DEFAULTS: AISettings = {
  efSearch: 64,
  cosineThreshold: 0.35,
  maxResults: 50,
  minFaceConfidence: 0.85,
  blurMin: 100,
  brightnessMin: 0.12,
  brightnessMax: 0.94,
};

/**
 * Reads AI/face settings from DB with in-memory caching (5 min TTL).
 * Falls back to hardcoded defaults if DB is unavailable.
 */
export async function getSettingsFromDB(): Promise<AISettings> {
  const cached = settingsCache.get(CACHE_KEY);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return cached.value;
  }

  try {
    const rows = await db
      .select()
      .from(filterConfig)
      .where(eq(filterConfig.id, 1))
      .limit(1);

    if (rows.length === 0) {
      return SETTING_DEFAULTS;
    }

    const row = rows[0] as any;
    const settings: AISettings = {
      efSearch: row.efSearch ?? SETTING_DEFAULTS.efSearch,
      cosineThreshold: row.faceSimilarityDist ?? SETTING_DEFAULTS.cosineThreshold,
      maxResults: row.maxResults ?? SETTING_DEFAULTS.maxResults,
      minFaceConfidence: row.minFaceConfidence ?? SETTING_DEFAULTS.minFaceConfidence,
      blurMin: row.blurMin ?? SETTING_DEFAULTS.blurMin,
      brightnessMin: row.brightnessMin ?? SETTING_DEFAULTS.brightnessMin,
      brightnessMax: row.brightnessMax ?? SETTING_DEFAULTS.brightnessMax,
    };

    settingsCache.set(CACHE_KEY, { value: settings, cachedAt: Date.now() });
    return settings;
  } catch (error) {
    console.error("[aiTuner] Failed to load settings from DB, using defaults:", error);
    return SETTING_DEFAULTS;
  }
}

/**
 * Invalidates the settings cache, forcing the next call to getSettingsFromDB()
 * to re-fetch from the database. Call this after saving updated settings.
 */
export function invalidateSettingsCache(): void {
  settingsCache.delete(CACHE_KEY);
}

/**
 * @deprecated Quality filter system has been removed.
 * All photos are now approved automatically without quality checks.
 */
export async function runAIAutoTuner(): Promise<void> {
  // No-op: quality filter removed
  return;
}
