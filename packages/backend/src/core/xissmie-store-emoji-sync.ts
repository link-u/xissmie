/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { MiMeta } from '@/models/Meta.js';

/** 実行をまたぐ再試行上限（初回含め）。 */
export const MAX_RUNS = 2;

/** 1実行内の試行回数（初回含め）。 */
export const IN_RUN_MAX_ATTEMPTS = 2;

/** 試行間バックオフ（ms）。1回目失敗後: 2s（±20%ジッタ）。 */
export const BACKOFF_BASE_MS = [2000] as const;

/** バックオフのジッタ比率（±）。 */
export const BACKOFF_JITTER_RATIO = 0.2;

/** 1件あたりのアップロードタイムアウト（ms）。 */
export const ATTEMPT_TIMEOUT_MS = 30_000;

/** 1実行のデッドライン（ms）。 */
export const RUN_DEADLINE_MS = 30 * 60 * 1000;

/** 1実行で再アップロードする件数上限。 */
export const MAX_REUPLOADS_PER_RUN = 100;

/** 再アップロード並列度。 */
export const UPLOAD_CONCURRENCY = 5;

/** 連続失敗件数。 */
export const CIRCUIT_CONSECUTIVE_FAILS = 20;

/** 失敗率閾値。 */
export const CIRCUIT_FAIL_RATE = 0.5;

/** 失敗率判定の最小母数。 */
export const CIRCUIT_MIN_SAMPLES = 10;

export const RETRY_REDIS_KEY_PREFIX = 'xissmie:emojiSyncRetry:';

export const INTEGRITY_PAGE_SIZE = 500;
export const INTEGRITY_CONCURRENCY = 5;
export const INTEGRITY_EMAIL_ITEM_LIMIT = 30;

/** 運用向け通知先メール。本番アドレスに差し替える。 */
export const OPS_NOTIFICATION_EMAIL = 'xissmie-ops-emoji-sync@mock.invalid';

export function retryRedisKey(emojiId: string): string {
	return `${RETRY_REDIS_KEY_PREFIX}${emojiId}`;
}

/**
 * DriveService.save と同じ公開ベース URL。
 */
export function getObjectStoragePublicBaseUrl(meta: Pick<MiMeta,
	'objectStorageBaseUrl' | 'objectStorageUseSSL' | 'objectStorageEndpoint' | 'objectStoragePort' | 'objectStorageBucket'
>): string {
	return meta.objectStorageBaseUrl
		?? `${meta.objectStorageUseSSL ? 'https' : 'http'}://${meta.objectStorageEndpoint}${meta.objectStoragePort ? `:${meta.objectStoragePort}` : ''}/${meta.objectStorageBucket}`;
}

export function tryParseObjectStorageKey(baseUrl: string, publicUrl: string): string | null {
	if (!baseUrl || !publicUrl) return null;
	const prefix = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
	if (!publicUrl.startsWith(prefix)) return null;
	const key = decodeURIComponent(publicUrl.slice(prefix.length));
	return key.length > 0 ? key : null;
}

export function tryParseInternalStorageKey(origin: string, publicUrl: string): string | null {
	if (!origin || !publicUrl) return null;
	const prefix = `${origin.replace(/\/$/, '')}/files/`;
	if (!publicUrl.startsWith(prefix)) return null;
	const key = decodeURIComponent(publicUrl.slice(prefix.length).split('?')[0] ?? '');
	return key.length > 0 ? key : null;
}

/** Redis 値（実行回数、または `runs:xfolioUpdatedAt`）から実行回数を取る。 */
export function parseRetryRunCount(value: string | null): number {
	if (value == null || value === '') return 0;
	const head = value.split(':')[0];
	const n = Number.parseInt(head ?? '', 10);
	return Number.isFinite(n) ? n : 0;
}

/** Redis 値から記録済み Xfolio updatedAt（ms）を取る。無ければ null。 */
export function parseRetryXfolioUpdatedAt(value: string | null): number | null {
	if (value == null || value === '') return null;
	const parts = value.split(':');
	if (parts.length < 2) return null;
	const n = Number.parseInt(parts[1] ?? '', 10);
	return Number.isFinite(n) ? n : null;
}

/** Redis に保存する値。`runs:xfolioUpdatedAtMs` */
export function formatRetryRedisValue(runs: number, xfolioUpdatedAtMs: number): string {
	return `${runs}:${xfolioUpdatedAtMs}`;
}

/** 試行間待ち（指数バックオフ ± ジッタ）。attemptIndex は 0 始まり（1回目失敗後が 0）。 */
export function backoffDelayMs(attemptIndex: number, random: () => number = Math.random): number {
	const base = BACKOFF_BASE_MS[Math.min(attemptIndex, BACKOFF_BASE_MS.length - 1)] ?? BACKOFF_BASE_MS[BACKOFF_BASE_MS.length - 1]!;
	const jitter = 1 + (random() * 2 - 1) * BACKOFF_JITTER_RATIO;
	return Math.max(0, Math.round(base * jitter));
}

export function shouldTripCircuit(params: {
	consecutiveFails: number;
	failed: number;
	attempted: number;
}): boolean {
	if (params.consecutiveFails >= CIRCUIT_CONSECUTIVE_FAILS) return true;
	if (params.attempted >= CIRCUIT_MIN_SAMPLES && (params.failed / params.attempted) > CIRCUIT_FAIL_RATE) {
		return true;
	}
	return false;
}
