/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, vi } from 'vitest';
import { fetchMoreStoreItems, getStoreEmojiOwnership } from '@/utility/xissmie-store.js';

describe('Xissmie store pagination', () => {
	test('an empty list stops without requesting a cursor', async () => {
		const fetchPage = vi.fn(async () => [{ id: 'a' }]);
		expect(await fetchMoreStoreItems([], 2, fetchPage)).toEqual({ items: [], hasMore: false });
		expect(fetchPage).not.toHaveBeenCalled();
	});

	test('uses the last id, appends a full page and leaves the original list intact', async () => {
		const items = [{ id: 'c' }];
		const fetchPage = vi.fn(async () => [{ id: 'b' }, { id: 'a' }]);
		expect(await fetchMoreStoreItems(items, 2, fetchPage)).toEqual({
			items: [{ id: 'c' }, { id: 'b' }, { id: 'a' }], hasMore: true,
		});
		expect(fetchPage).toHaveBeenCalledWith('c');
		expect(items).toEqual([{ id: 'c' }]);
	});

	test.each([{ page: [] }, { page: [{ id: 'a' }] }])('a short page ends pagination: $page', async ({ page }) => {
		expect((await fetchMoreStoreItems([{ id: 'b' }], 2, async () => page)).hasMore).toBe(false);
	});

	test('propagates request errors without discarding existing items', async () => {
		const items = [{ id: 'a' }];
		await expect(fetchMoreStoreItems(items, 2, async () => { throw new Error('offline'); })).rejects.toThrow('offline');
		expect(items).toEqual([{ id: 'a' }]);
	});
});

describe('Xissmie store emoji ownership', () => {
	test.each([':creator_e_smile:', ':creator-store-smile:'])('does not classify an unverified cache as unowned: %s', name => {
		expect(getStoreEmojiOwnership(name, [], false)).toBe('unknown');
		expect(getStoreEmojiOwnership(name, [{ name: name.replaceAll(':', '') }], false)).toBe('unknown');
	});

	test('allows an owned emoji after synchronization', () => {
		expect(getStoreEmojiOwnership(':creator_e_smile:', [{ name: 'creator_e_smile' }], true)).toBe('owned');
	});

	test('only confirms an unowned emoji after synchronization', () => {
		expect(getStoreEmojiOwnership(':creator_e_smile:', [], true)).toBe('unowned');
	});

	test.each([':normal:', '😀'])('does not gate ordinary emoji while loading: %s', name => {
		expect(getStoreEmojiOwnership(name, [], false)).toBe('not-store');
	});
});
