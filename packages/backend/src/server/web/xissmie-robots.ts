/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * Xissmie: robots.txt でブロックする AI クローラーの User-agent 一覧
 *
 * 本家 Misskey は robots.txt を ClientServerService で動的生成するようになったため
 * (misskey-dev/misskey#17165)、以前の assets/robots.txt は配信されなくなった。
 * Xissmie 独自のブロック設定はここに集約し、本家の生成結果の先頭に差し込む。
 */
export const XISSMIE_BLOCKED_AI_CRAWLERS = [
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
] as const;

export function buildXissmieRobotsTxtPrefix(): string {
	return XISSMIE_BLOCKED_AI_CRAWLERS.map((ua) => `User-agent: ${ua}\nDisallow: /\n\n`).join('');
}
