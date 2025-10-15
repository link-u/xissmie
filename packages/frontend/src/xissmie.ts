/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import * as os from '@/os.js';

export async function xissmiePurchaseRequired(emoji: string) {
	const { canceled } = await os.confirm({
		type: 'info',
		title: 'この絵文字を所有していません。',
		text: 'このカスタム絵文字の販売ページを表示しますか？',
	});
	if (canceled) return;

	window.open(`/xissmie/store/emojis/${emoji.replaceAll(':', '')}`, '_blank', 'noopener');
}
