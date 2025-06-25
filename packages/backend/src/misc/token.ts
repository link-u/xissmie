/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { secureRndstr } from '@/misc/secure-rndstr.js';

// eslint-disable-next-line import/no-default-export
export default () => 'Xissme' + secureRndstr(32);

export const generateNativeUserToken = () => secureRndstr(16);

// バージョンアップ前後の両方のトークンをサポート
// 16文字の従来トークン または 'Xissme'で始まる新トークン
export const isNativeUserToken = (token: string) => token.length === 16 || token.startsWith('Xissme');
