/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { EventEmitter } from 'node:events';
import { describe, expect, test, vi } from 'vitest';
import Connection from '@/server/api/stream/Connection.js';

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>(r => { resolve = r; });
	return { promise, resolve };
}

async function flush() {
	for (let i = 0; i < 10; i++) await Promise.resolve();
}

describe('stream connection message queue', () => {
	test('terminates a connection when its incoming queue overflows', async () => {
		const gate = deferred<any>();
		const moduleRef = {
			registerRequestByContextId: vi.fn(),
			create: vi.fn(() => gate.promise),
		};
		const connection = new Connection(moduleRef as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any);
		const socket = Object.assign(new EventEmitter(), { readyState: 1, terminate: vi.fn() });
		await connection.listen(new EventEmitter(), socket as any);

		socket.emit('message', Buffer.from(JSON.stringify({ type: 'connect', body: { channel: 'clip', id: 'one' } })));
		await flush();
		expect(moduleRef.create).toHaveBeenCalledTimes(1);
		for (let i = 0; i < 256; i++) {
			socket.emit('message', Buffer.from('{"type":"s","body":{"id":"note"}}'));
		}
		expect(socket.terminate).toHaveBeenCalledTimes(1);
		connection.dispose();
		socket.readyState = 3;
		gate.resolve({});
		await flush();
	});

	test('disposes listeners registered after a connection closes during channel init', async () => {
		const gate = deferred<void>();
		const subscriber = new EventEmitter();
		const listener = vi.fn();
		const channel = {
			id: 'one',
			init: vi.fn(async () => {
				await gate.promise;
				subscriber.on('clipStream:one', listener);
				return true;
			}),
			dispose: vi.fn(() => subscriber.off('clipStream:one', listener)),
		};
		const moduleRef = {
			registerRequestByContextId: vi.fn(),
			create: vi.fn().mockResolvedValue(channel),
		};
		const connection = new Connection(moduleRef as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any);
		const socket = Object.assign(new EventEmitter(), { readyState: 1, terminate: vi.fn() });
		await connection.listen(subscriber, socket as any);
		const connecting = connection.connectChannel('one', {}, 'clip');
		await flush();
		expect(channel.init).toHaveBeenCalledTimes(1);
		socket.readyState = 3;
		connection.dispose();
		gate.resolve();
		await connecting;
		expect(channel.dispose).toHaveBeenCalledTimes(2);
		expect(subscriber.listenerCount('clipStream:one')).toBe(0);
	});
});
