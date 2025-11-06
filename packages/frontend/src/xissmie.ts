/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import * as os from '@/os.js';

export async function xissmieEmojiPurchaseRequired(emoji: string) {
	const { canceled } = await os.confirm({
		type: 'info',
		title: 'この絵文字を所有していません。',
		text: 'このカスタム絵文字の販売ページを表示しますか？',
	});
	if (canceled) return;

	const normalized = emoji.replaceAll(':', '').replaceAll('@.', '');
	window.open(`/xissmie/store/emojis/${normalized}`, '_blank', 'noopener');
}

export async function xissmieAvatarDecorationPurchaseRequired(decoration: { id: string; }) {
	const { canceled } = await os.confirm({
		type: 'info',
		title: 'このデコレーションを所有していません。',
		text: 'このデコレーションの販売ページを表示しますか？',
	});
	if (canceled) return;

	window.open(`/xissmie/store/avatar-decorations/${decoration.id}`, '_blank', 'noopener');
}
