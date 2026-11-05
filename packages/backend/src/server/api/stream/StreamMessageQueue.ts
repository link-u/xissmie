/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/** Serial queue with a per-connection bound on messages and their raw payload bytes. */
export class StreamMessageQueue<T> {
	private readonly pending: { value: T; bytes: number }[] = [];
	private running = false;
	private closed = false;
	private activeBytes = 0;
	private pendingBytes = 0;

	constructor(
		private readonly maxMessages: number,
		private readonly maxBytes: number,
		private readonly processMessage: (value: T) => Promise<void>,
		private readonly onError: () => void,
	) {}

	public get messageCount(): number {
		return this.pending.length + (this.running ? 1 : 0);
	}

	public get byteCount(): number {
		return this.pendingBytes + this.activeBytes;
	}

	/** Return false if closed or if accepting this message would exceed a limit. */
	public enqueue(value: T, bytes: number): boolean {
		if (this.closed || this.messageCount >= this.maxMessages || this.byteCount + bytes > this.maxBytes) return false;
		this.pending.push({ value, bytes });
		this.pendingBytes += bytes;
		void this.drain();
		return true;
	}

	/** Drop waiting messages immediately; an already-running handler cannot be cancelled. */
	public dispose(): void {
		this.closed = true;
		this.pending.length = 0;
		this.pendingBytes = 0;
	}

	private async drain(): Promise<void> {
		if (this.running || this.closed) return;
		this.running = true;
		try {
			while (!this.closed && this.pending.length > 0) {
				const item = this.pending.shift();
				if (item == null) break;
				this.pendingBytes -= item.bytes;
				this.activeBytes = item.bytes;
				try {
					await this.processMessage(item.value);
				} catch {
					this.dispose();
					this.onError();
					return;
				} finally {
					this.activeBytes = 0;
				}
			}
		} finally {
			this.running = false;
		}
	}
}
