/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

process.env.NODE_ENV = 'test';

import * as assert from 'node:assert';
import { describe, test } from 'vitest';
import { relativeFetch } from '../../utils.js';

/*
 * Xissmie 独自の Web(HTML/静的ファイル)まわりのテスト。
 */
describe('[Xissmie] Web', () => {
	describe('robots.txt', () => {
		// 技術仕様「AI クローラー対策」でブロックしている User-agent
		const blockedAiCrawlers = [
			'Google-Extended',
			'GPTBot',
			'facebookbot',
			'anthropic-ai',
			'ClaudeBot',
			'Applebot-Extended',
			'meta-externalagent',
			'cohere-ai',
			'CCBot',
			'omgili',
			'omgilibot',
			'Diffbot',
		];

		async function fetchRobotsTxt(): Promise<string> {
			const res = await relativeFetch('robots.txt');
			assert.strictEqual(res.status, 200);
			assert.match(res.headers.get('content-type') ?? '', /^text\/plain/);
			return await res.text();
		}

		test.each(blockedAiCrawlers)('AI クローラー %s をブロックしている', async (ua) => {
			const robots = await fetchRobotsTxt();
			const escaped = ua.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
			assert.match(robots, new RegExp(`^User-agent: ${escaped}\\nDisallow: /$`, 'm'), robots);
		});

		test('その他のクローラー向けの設定(User-agent: *)も残っている', async () => {
			const robots = await fetchRobotsTxt();
			assert.match(robots, /^User-agent: \*$/m, robots);
			assert.match(robots, /^Allow: \/$/m, robots);
		});
	});

	describe('HTML', () => {
		test('フロントエンドが Xfolio のホストを知るための meta タグが出力される', async () => {
			const res = await relativeFetch('', { headers: { Accept: 'text/html' } });
			assert.strictEqual(res.status, 200);
			const html = await res.text();
			assert.match(html, /<meta property="xfolio_api_host"/);
		});
	});
});
