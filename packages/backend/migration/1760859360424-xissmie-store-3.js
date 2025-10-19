/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class XissmieStore31760859360424 {
    name = 'XissmieStore31760859360424'

    /**
     * @param {QueryRunner} queryRunner
     */
    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "user_owned_emoji" ADD "emojiName" character varying(128) NOT NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_0186bae923e551c7b1b16c3697" ON "user_owned_emoji" ("emojiName") `);
    }

    /**
     * @param {QueryRunner} queryRunner
     */
    async down(queryRunner) {
        await queryRunner.query(`DROP INDEX "public"."IDX_0186bae923e551c7b1b16c3697"`);
        await queryRunner.query(`ALTER TABLE "user_owned_emoji" DROP COLUMN "emojiName"`);
    }
}
