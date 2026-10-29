/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { test as base, expect } from '@playwright/test';
import { stubXfolio } from './utils.js';

// 本家 test/e2e/ignorable-errors.ts と同じもの
const IGNORABLE_ERROR_MESSAGES = [
	'The source image cannot be decoded',
	'ResizeObserver loop limit exceeded',
	'ResizeObserver loop completed with undelivered notifications',
] as const;

/** 通常のtestの代わりにこちらを使用する */
export const test = base.extend<{ _xissmieSetup: void }>({
	_xissmieSetup: [async ({ page, context }, use) => {
		await page.addInitScript((messages) => {
			function includesIgnorableMessage(message: unknown): boolean {
				if (typeof message !== 'string') return false;
				return messages.some((text) => message.includes(text));
			}

			window.addEventListener('error', (event) => {
				if (includesIgnorableMessage(event.message)) {
					event.preventDefault();
				}
			});

			window.addEventListener('unhandledrejection', (event) => {
				const reason = event.reason;
				const message = reason instanceof Error ? reason.message : String(reason);
				if (includesIgnorableMessage(message)) {
					event.preventDefault();
				}
			});

			//@ts-ignore
			window.isPlaywright = true;
		}, [...IGNORABLE_ERROR_MESSAGES]);

		// Xfolio への遷移は常にスタブする(外部サイトには出ない)
		await stubXfolio(context);

		await use();
	}, { auto: true }],
});

export { expect };
