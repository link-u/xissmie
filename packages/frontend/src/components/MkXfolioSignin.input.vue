<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
	<div :class="$style.wrapper" data-cy-signin-page-input>
		<div :class="$style.root">
			<div class="_gaps_m">
				<div style="text-align: center;">
					<div>{{ "「Xissmie（キスミー）は「Xfolio（クロスフォリオ）の会員専用SNSです。" }}</div>
					<div style="font-weight: bold; margin-top: 0.5em;">{{ "クロスフォリオからログインができます。" }}</div>
					<div style="font-weight: bold; margin-top: 0.5em;">{{ "※Xissmieのユーザー名を登録していない場合は、クロスフォリオにログイン後、マイページからXissmieユーザー名を登録してください。" }}</div>
				</div>

				<MkButton full rounded gradate data-cy-signup link to="https://xfolio.jp/mypage/xissmie_setting?from_xissmie=yes" style="padding: 10px">{{ "クロスフォリオでログインする" }}</MkButton>

				<MkButton :class="$style.mainAction" full rounded data-cy-signin @click="signin()">{{ "ID/PASSでログインする" }}</MkButton>
				<MkLink url="https://xfolio.jp/mypage/xissmie_setting">{{"クロスフォリオでID/PASSを調べる"}}</MkLink>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { toUnicode } from 'punycode.js';

import { query, extractDomain } from '@@/js/url.js';
import { host as configHost } from '@@/js/config.js';
import type { OpenOnRemoteOptions } from '@/scripts/please-login.js';
import { i18n } from '@/i18n.js';
import * as os from '@/os.js';

import MkButton from '@/components/MkButton.vue';
import MkLink from "@/components/MkLink.vue";
import XPassSigninDialog from "@/components/MkSigninDialog.vue";

const props = withDefaults(defineProps<{
	message?: string,
	openOnRemote?: OpenOnRemoteOptions,
}>(), {
	message: '',
	openOnRemote: undefined,
});

const emit = defineEmits<{
	(ev: 'usernameSubmitted', v: string): void;
	(ev: 'passkeyClick', v: MouseEvent): void;
}>();

const host = toUnicode(configHost);

const username = ref('');

function signin() {
	const { dispose } = os.popup(XPassSigninDialog, {
		autoSet: true,
	}, {
		closed: () => dispose(),
	});
}

//#endregion
</script>

<style lang="scss" module>
.root {
	display: flex;
	flex-direction: column;
	gap: 20px;
}

.wrapper {
	display: flex;
	align-items: center;
	width: 100%;
	min-height: 336px;

	> .root {
		width: 100%;
	}
}

.avatar {
	margin: 0 auto;
	background-color: color-mix(in srgb, var(--MI_THEME-fg), transparent 85%);
	color: color-mix(in srgb, var(--MI_THEME-fg), transparent 25%);
	text-align: center;
	height: 64px;
	width: 64px;
	font-size: 24px;
	line-height: 64px;
	border-radius: 50%;
}

.instanceManualSelectButton {
	display: block;
	text-align: center;
	opacity: .7;
	font-size: .8em;

	&:hover {
		text-decoration: underline;
	}
}

.orHr {
	position: relative;
	margin: .4em auto;
	width: 100%;
	height: 1px;
	background: var(--MI_THEME-divider);
}

.orMsg {
	position: absolute;
	top: -.6em;
	display: inline-block;
	padding: 0 1em;
	background: var(--MI_THEME-panel);
	font-size: 0.8em;
	color: var(--MI_THEME-fgOnPanel);
	margin: 0;
	left: 50%;
	transform: translateX(-50%);
}

.mainAction {
	line-height: 28px;
}
</style>
