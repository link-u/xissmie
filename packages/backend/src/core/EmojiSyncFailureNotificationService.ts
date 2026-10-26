/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { DI } from '@/di-symbols.js';
import { bindThis } from '@/decorators.js';
import { EmailService } from '@/core/EmailService.js';
import { LoggerService } from '@/core/LoggerService.js';
import type { MiMeta } from '@/models/_.js';
import type Logger from '@/logger.js';
import {
	INTEGRITY_EMAIL_ITEM_LIMIT,
	OPS_NOTIFICATION_EMAIL,
} from '@/core/xissmie-store-emoji-sync.js';

export type EmojiRetryLimitReachedItem = {
	id: string;
	name: string;
};

/**
 * ストア絵文字の運用向けメール通知。
 * 送信するのは「2実行×各2試行まで失敗して除外したとき」のみ。
 */
@Injectable()
export class EmojiSyncFailureNotificationService {
	private logger: Logger;

	constructor(
		@Inject(DI.meta)
		private meta: MiMeta,

		private emailService: EmailService,
		private loggerService: LoggerService,
	) {
		this.logger = this.loggerService.getLogger('xissmie-emoji-sync-notify');
	}

	/**
	 * 実行またぎ再試行上限に達し除外した絵文字を運用へ通知する。
	 */
	@bindThis
	public async notifyRetryLimitReached(items: EmojiRetryLimitReachedItem[]): Promise<boolean> {
		if (items.length === 0) return true;

		const shown = items.slice(0, INTEGRITY_EMAIL_ITEM_LIMIT);
		const more = items.length - shown.length;
		const lines = [
			'ストア絵文字の再アップロードが上限に達したため対象から除外しました。',
			'1実行あたり最大2試行・実行またぎ最大2実行まで失敗しています。',
			'以降の同期ジョブでは再試行しません（Xfolio 側 updatedAt 更新時のみ復帰）。',
			`除外件数: ${items.length}`,
			'',
			...shown.map(x => `- ${x.id} ${x.name}`),
		];
		if (more > 0) {
			lines.push('', `ほか ${more} 件`);
		}

		return await this.notifyOps(
			'[Xissmie] ストア絵文字の再試行上限到達',
			lines.join('\n'),
			lines.join('<br>'),
		);
	}

	/**
	 * 運用向けメールを送る。SMTP 未設定・送信失敗でも throw しない。
	 */
	@bindThis
	public async notifyOps(subject: string, text: string, html: string = text): Promise<boolean> {
		if (!this.isEmailReady()) {
			this.logger.warn('skip ops email: enableEmail or SMTP/from address is not configured');
			return false;
		}

		try {
			await this.emailService.sendEmail(OPS_NOTIFICATION_EMAIL, subject, html, text);
			this.logger.info(`ops email sent: to=${OPS_NOTIFICATION_EMAIL} subject=${subject}`);
			return true;
		} catch (err) {
			const reason = err instanceof Error ? err.message : String(err);
			this.logger.error(`ops email failed: to=${OPS_NOTIFICATION_EMAIL} subject=${subject} reason=${reason}`, {
				e: err,
			});
			return false;
		}
	}

	@bindThis
	private isEmailReady(): boolean {
		if (!this.meta.enableEmail) return false;
		if (this.meta.smtpHost == null || this.meta.smtpHost === '') return false;
		if (this.meta.smtpPort == null) return false;
		if (this.meta.email == null || this.meta.email === '') return false;
		return true;
	}
}
