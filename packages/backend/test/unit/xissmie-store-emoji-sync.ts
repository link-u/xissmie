/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

process.env.NODE_ENV = 'test';

import {
	CIRCUIT_CONSECUTIVE_FAILS,
	CIRCUIT_MIN_SAMPLES,
	backoffDelayMs,
	formatRetryRedisValue,
	getObjectStoragePublicBaseUrl,
	parseRetryRunCount,
	parseRetryXfolioUpdatedAt,
	shouldTripCircuit,
	tryParseInternalStorageKey,
	tryParseObjectStorageKey,
} from '@/core/xissmie-store-emoji-sync.js';

describe('xissmie-store-emoji-sync helpers', () => {
	test('parseRetryRunCount reads head of runs:updatedAt', () => {
		expect(parseRetryRunCount(null)).toBe(0);
		expect(parseRetryRunCount('')).toBe(0);
		expect(parseRetryRunCount('2')).toBe(2);
		expect(parseRetryRunCount('1:1726000000000')).toBe(1);
	});

	test('parseRetryXfolioUpdatedAt reads trailing timestamp', () => {
		expect(parseRetryXfolioUpdatedAt(null)).toBeNull();
		expect(parseRetryXfolioUpdatedAt('2')).toBeNull();
		expect(parseRetryXfolioUpdatedAt('1:1726000000000')).toBe(1726000000000);
	});

	test('formatRetryRedisValue builds runs:updatedAt', () => {
		expect(formatRetryRedisValue(2, 1000)).toBe('2:1000');
	});

	test('backoffDelayMs applies base with jitter bounds', () => {
		expect(backoffDelayMs(0, () => 0.5)).toBe(2000);
		expect(backoffDelayMs(1, () => 0.5)).toBe(8000);
		const low = backoffDelayMs(0, () => 0);
		const high = backoffDelayMs(0, () => 1);
		expect(low).toBe(1600);
		expect(high).toBe(2400);
	});

	test('shouldTripCircuit on consecutive fails', () => {
		expect(shouldTripCircuit({
			consecutiveFails: CIRCUIT_CONSECUTIVE_FAILS,
			failed: CIRCUIT_CONSECUTIVE_FAILS,
			attempted: CIRCUIT_CONSECUTIVE_FAILS,
		})).toBe(true);
		expect(shouldTripCircuit({
			consecutiveFails: CIRCUIT_CONSECUTIVE_FAILS - 1,
			failed: 5,
			attempted: 9,
		})).toBe(false);
	});

	test('shouldTripCircuit on fail rate with enough samples', () => {
		expect(shouldTripCircuit({
			consecutiveFails: 0,
			failed: 6,
			attempted: CIRCUIT_MIN_SAMPLES,
		})).toBe(true);
		expect(shouldTripCircuit({
			consecutiveFails: 0,
			failed: 4,
			attempted: CIRCUIT_MIN_SAMPLES,
		})).toBe(false);
	});

	test('tryParseObjectStorageKey extracts key from public base URL', () => {
		const base = 'https://cdn.example/bucket';
		expect(tryParseObjectStorageKey(base, `${base}/webpublic-1.png`)).toBe('webpublic-1.png');
		expect(tryParseObjectStorageKey(base, 'https://other.example/x.png')).toBeNull();
	});

	test('tryParseInternalStorageKey extracts key from /files/', () => {
		expect(tryParseInternalStorageKey('https://sns.example', 'https://sns.example/files/abc.png')).toBe('abc.png');
		expect(tryParseInternalStorageKey('https://sns.example', 'https://cdn.example/abc.png')).toBeNull();
	});

	test('getObjectStoragePublicBaseUrl prefers objectStorageBaseUrl', () => {
		expect(getObjectStoragePublicBaseUrl({
			objectStorageBaseUrl: 'https://cdn.example',
			objectStorageUseSSL: true,
			objectStorageEndpoint: 'r2.example',
			objectStoragePort: null,
			objectStorageBucket: 'b',
		})).toBe('https://cdn.example');
	});
});
