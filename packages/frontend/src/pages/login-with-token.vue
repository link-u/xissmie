<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div>
	<MkAnimBg style="position: fixed; top: 0;"/>
	<div :class="$style.formContainer">
		<div :class="$style.form">
			{{ message }}
		</div>
	</div>
</div>
</template>

<script lang="ts" setup>
import { ref } from 'vue';
import MkAnimBg from '@/components/MkAnimBg.vue';
import { definePage } from '@/page.js';
import { $i, login } from '@/account.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { serverContext, assertServerContext } from '@/server-context.js';

const token = assertServerContext(serverContext, 'token') ? serverContext.token : null;

const message = ref('ログイン中...');

if ($i != null) {
	message.value = 'Xissmieにログインしました';
	window.location.href = '/timeline';
} else if (token == null) {
	message.value = 'ログイン情報が不正です';
} else {
	misskeyApi('login-with-token', {
		token: token,
	}).then((user) => {
		if (user && user.token && typeof user.token === 'string') {
			login(user.token, undefined, false).then(() => {
				message.value = 'Xfolioへのログインが完了しました！';
				window.location.href = '/timeline';
			}).catch(() => {
				message.value = 'アカウント情報の取得に失敗しました';
			});
		} else {
			message.value = 'ログイン情報の取得に失敗しました';
		}
	}).catch((err) => {
		console.error('Login failed:', err);
		if (err?.code === 'INVALID_LOGIN_TOKEN') {
			message.value = 'ログイン用トークンが無効です。再度ログインしてください。';
		} else {
			message.value = 'ログインに失敗しました';
		}
	});
}

definePage(() => ({
	title: 'MiAuth',
	icon: 'ti ti-apps',
}));
</script>

<style lang="scss" module>
.formContainer {
	min-height: 100svh;
	padding: 32px 32px calc(env(safe-area-inset-bottom, 0px) + 32px) 32px;
	box-sizing: border-box;
	display: grid;
	place-content: center;
}

.form {
	position: relative;
	z-index: 10;
	border-radius: var(--MI-radius);
	background-color: var(--MI_THEME-panel);
	box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
	overflow: clip;
	max-width: 500px;
	width: calc(100vw - 64px);
	height: min(65svh, calc(100svh - calc(env(safe-area-inset-bottom, 0px) + 64px)));
	overflow-y: scroll;
	box-sizing: border-box;
	padding: 32px;
	text-align: center;
}
</style>
