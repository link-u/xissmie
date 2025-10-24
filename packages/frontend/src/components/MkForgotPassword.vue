<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<MkModalWindow
	ref="dialog"
	:width="370"
	:height="400"
	@close="dialog?.close()"
	@closed="emit('closed')"
>
	<template #header>{{ i18n.ts.forgotPassword }}</template>

	<div class="_spacer" style="--MI_SPACER-min: 20px; --MI_SPACER-max: 28px;">
		<div>
			<p>
				Xissmieのログインパスワードを確認したい場合は、<a :href="`${xfolioUrlOrigin}/login`" style="color: #0b65a5">こちら</a>からクロスフォリオにログインし、『マイページ』⇒『設定』⇒『Xissmie設定』から『Xissmieのログイン用ID/PASSを表示』を押してIDをご確認ください。<br>
				（パスワードをメモしなくても、クロスフォリオにログイン後は、ヘッダーにあるXissmieのロゴを押下するだけで自動ログインできます）
			</p>
		</div>
	</div>
</MkModalWindow>
</template>

<script lang="ts" setup>
import { ref, useTemplateRef } from 'vue';
import { xfolioUrlOrigin } from '@@/js/config.js';
import MkModalWindow from '@/components/MkModalWindow.vue';
import MkButton from '@/components/MkButton.vue';
import MkInput from '@/components/MkInput.vue';
import MkInfo from '@/components/MkInfo.vue';
import * as os from '@/os.js';
import { instance } from '@/instance.js';
import { i18n } from '@/i18n.js';

const emit = defineEmits<{
	(ev: 'done'): void;
	(ev: 'closed'): void;
}>();

const dialog = useTemplateRef('dialog');

const username = ref('');
const email = ref('');
const processing = ref(false);

async function onSubmit() {
	processing.value = true;
	await os.apiWithDialog('request-reset-password', {
		username: username.value,
		email: email.value,
	});
	emit('done');
	dialog.value?.close();
}
</script>
