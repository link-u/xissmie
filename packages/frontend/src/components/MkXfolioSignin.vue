<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
	<div :class="$style.signinRoot">
		<Transition
			mode="out-in"
			:enterActiveClass="$style.transition_enterActive"
			:leaveActiveClass="$style.transition_leaveActive"
			:enterFromClass="$style.transition_enterFrom"
			:leaveToClass="$style.transition_leaveTo"

			:inert="waiting"
		>
			<XInput
				v-if="page === 'input'"
				key="input"
				:message="message"
				:openOnRemote="openOnRemote"
			/>
		</Transition>
		<div v-if="waiting" :class="$style.waitingRoot">
			<MkLoading/>
		</div>
	</div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';
import * as Misskey from 'misskey-js';

import type { OpenOnRemoteOptions } from '@/scripts/please-login.js';

import XInput from '@/components/MkXfolioSignin.input.vue';

const emit = defineEmits<{
	(ev: 'login', v: Misskey.entities.SigninFlowResponse & { finished: true }): void;
}>();

const props = withDefaults(defineProps<{
	autoSet?: boolean;
	message?: string,
	openOnRemote?: OpenOnRemoteOptions,
}>(), {
	autoSet: false,
	message: '',
	openOnRemote: undefined,
});

const page = ref<'input' | 'password' | 'totp' | 'passkey'>('input');
const waiting = ref(false);

const needCaptcha = ref(false);

const userInfo = ref<null | Misskey.entities.UserDetailed>(null);
const password = ref('');

onBeforeUnmount(() => {
	password.value = '';
	needCaptcha.value = false;
	userInfo.value = null;
});
</script>

<style lang="scss" module>
.transition_enterActive,
.transition_leaveActive {
	transition: opacity 0.3s cubic-bezier(0,0,.35,1), transform 0.3s cubic-bezier(0,0,.35,1);
}
.transition_enterFrom {
	opacity: 0;
	transform: translateX(50px);
}
.transition_leaveTo {
	opacity: 0;
	transform: translateX(-50px);
}

.signinRoot {
	overflow-x: hidden;
	overflow-x: clip;

	position: relative;
}

.waitingRoot {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	background-color: color-mix(in srgb, var(--MI_THEME-panel), transparent 50%);
	display: flex;
	justify-content: center;
	align-items: center;
	z-index: 1;
}
</style>
