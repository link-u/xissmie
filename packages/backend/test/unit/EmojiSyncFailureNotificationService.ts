/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

process.env.NODE_ENV = 'test';

import { jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { DI } from '@/di-symbols.js';
import { EmailService } from '@/core/EmailService.js';
import { EmojiSyncFailureNotificationService } from '@/core/EmojiSyncFailureNotificationService.js';
import { LoggerService } from '@/core/LoggerService.js';
import { OPS_NOTIFICATION_EMAIL } from '@/core/xissmie-store-emoji-sync.js';
import type { MiMeta } from '@/models/_.js';
import type { TestingModule } from '@nestjs/testing';

function readyMeta(overrides: Partial<MiMeta> = {}): MiMeta {
	return {
		enableEmail: true,
		smtpHost: 'smtp.example.com',
		smtpPort: 587,
		email: 'noreply@example.com',
		...overrides,
	} as MiMeta;
}

describe('EmojiSyncFailureNotificationService', () => {
	let app: TestingModule;
	let service: EmojiSyncFailureNotificationService;
	let sendEmail: jest.MockedFunction<EmailService['sendEmail']>;
	let meta: MiMeta;

	beforeEach(async () => {
		sendEmail = jest.fn(async () => {});
		meta = readyMeta();

		app = await Test.createTestingModule({
			providers: [
				EmojiSyncFailureNotificationService,
				{ provide: DI.meta, useValue: meta },
				{ provide: EmailService, useValue: { sendEmail } },
				{
					provide: LoggerService,
					useValue: {
						getLogger: () => ({
							info: jest.fn(),
							warn: jest.fn(),
							error: jest.fn(),
						}),
					},
				},
			],
		}).compile();

		service = app.get(EmojiSyncFailureNotificationService);
	});

	afterEach(async () => {
		await app.close();
	});

	test('notifyRetryLimitReached sends exclusion mail to ops', async () => {
		const sent = await service.notifyRetryLimitReached([
			{ id: 'e1', name: 'foo_e_a' },
		]);

		expect(sent).toBe(true);
		expect(sendEmail).toHaveBeenCalledTimes(1);
		expect(sendEmail.mock.calls[0]![0]).toBe(OPS_NOTIFICATION_EMAIL);
		expect(sendEmail.mock.calls[0]![1]).toBe('[Xissmie] ストア絵文字の再試行上限到達');
	});

	test('skips when enableEmail is off', async () => {
		meta.enableEmail = false;

		const sent = await service.notifyRetryLimitReached([
			{ id: 'e1', name: 'foo_e_a' },
		]);

		expect(sent).toBe(false);
		expect(sendEmail).not.toHaveBeenCalled();
	});

	test('skips when SMTP host is missing', async () => {
		meta.smtpHost = null;

		const sent = await service.notifyOps('subj', 'body');

		expect(sent).toBe(false);
		expect(sendEmail).not.toHaveBeenCalled();
	});

	test('does not throw when sendEmail fails', async () => {
		sendEmail.mockRejectedValueOnce(new Error('smtp down'));

		const sent = await service.notifyRetryLimitReached([
			{ id: 'e1', name: 'foo_e_a' },
		]);

		expect(sent).toBe(false);
	});

	test('notifyRetryLimitReached is a no-op for empty items', async () => {
		const sent = await service.notifyRetryLimitReached([]);

		expect(sent).toBe(true);
		expect(sendEmail).not.toHaveBeenCalled();
	});
});
