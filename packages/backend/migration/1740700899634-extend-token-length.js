/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class ExtendTokenLength1740700899634 {
    name = 'ExtendTokenLength1740700899634'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "token" TYPE character varying(128)`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "token" TYPE character varying(16)`);
    }
}
