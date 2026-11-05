/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, vi } from 'vitest';
import { StreamMessageQueue } from '@/server/api/stream/StreamMessageQueue.js';

function deferred() {
	let resolve!: () => void;
	const promise = new Promise<void>(r => { resolve = r; });
	return { promise, resolve };
}

async function flush() {
	for (let i = 0; i < 5; i++) await Promise.resolve();
}

describe('StreamMessageQueue', () => {
	test('processes in order and bounds messages, including the active message', async () => {
		const gate = deferred();
		const seen: number[] = [];
		const queue = new StreamMessageQueue<number>(2, 100, async value => {
			seen.push(value);
			if (value === 1) await gate.promise;
		}, vi.fn());

		expect(queue.enqueue(1, 10)).toBe(true);
		expect(queue.enqueue(2, 20)).toBe(true);
		expect(queue.enqueue(3, 1)).toBe(false);
		expect(queue.messageCount).toBe(2);
		expect(queue.byteCount).toBe(30);
		expect(seen).toEqual([1]);
		gate.resolve();
		await flush();
		expect(seen).toEqual([1, 2]);
		expect(queue.messageCount).toBe(0);
		expect(queue.byteCount).toBe(0);
	});

	test('limits bytes as well as message count', async () => {
		const gate = deferred();
		const queue = new StreamMessageQueue<number>(10, 5, () => gate.promise, vi.fn());
		expect(queue.enqueue(1, 3)).toBe(true);
		expect(queue.enqueue(2, 2)).toBe(true);
		expect(queue.enqueue(3, 1)).toBe(false);
		queue.dispose();
		gate.resolve();
		await flush();
		expect(queue.byteCount).toBe(0);
	});

	test('dispose releases queued messages and does not process them after the active handler finishes', async () => {
		const gate = deferred();
		const handler = vi.fn(() => gate.promise);
		const queue = new StreamMessageQueue<number>(10, 100, handler, vi.fn());
		queue.enqueue(1, 2);
		queue.enqueue(2, 3);
		queue.dispose();
		expect(queue.byteCount).toBe(2);
		expect(queue.enqueue(3, 1)).toBe(false);
		gate.resolve();
		await flush();
		expect(handler).toHaveBeenCalledTimes(1);
		expect(queue.byteCount).toBe(0);
	});

	test('handler failure closes the queue, drops pending messages and reports once', async () => {
		const gate = deferred();
		const onError = vi.fn();
		const handler = vi.fn(async () => { await gate.promise; throw new Error('failed'); });
		const queue = new StreamMessageQueue<number>(10, 100, handler, onError);
		queue.enqueue(1, 2);
		queue.enqueue(2, 3);
		gate.resolve();
		await flush();
		expect(onError).toHaveBeenCalledTimes(1);
		expect(handler).toHaveBeenCalledTimes(1);
		expect(queue.byteCount).toBe(0);
		expect(queue.enqueue(3, 1)).toBe(false);
	});
});
