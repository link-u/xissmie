/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export async function fetchMoreStoreItems<T extends { id: string }>(
	items: readonly T[],
	pageSize: number,
	fetchPage: (untilId: string) => Promise<T[]>,
): Promise<{ items: T[]; hasMore: boolean }> {
	const last = items.at(-1);
	if (!last) return { items: [], hasMore: false };

	const page = await fetchPage(last.id);
	return { items: [...items, ...page], hasMore: page.length >= pageSize };
}

export function getStoreEmojiOwnership(
	name: string,
	purchased: readonly { name: string }[],
	loaded: boolean,
): 'not-store' | 'unknown' | 'owned' | 'unowned' {
	const normalizedName = name.replaceAll(':', '');
	if (!normalizedName.includes('_e_') && !normalizedName.includes('-store-')) return 'not-store';
	if (!loaded) return 'unknown';
	return purchased.some(emoji => emoji.name === normalizedName) ? 'owned' : 'unowned';
}
