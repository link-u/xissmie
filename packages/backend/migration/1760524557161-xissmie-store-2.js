/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class XissmieStore21760524557161 {
    name = 'XissmieStore21760524557161'

    /**
     * @param {QueryRunner} queryRunner
     */
    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "avatar_decoration" ADD "storeAuthorId" character varying(128)`);
        await queryRunner.query(`ALTER TABLE "avatar_decoration" ADD "storeAuthorName" character varying(256)`);
        await queryRunner.query(`ALTER TABLE "emoji" ADD "storeAuthorId" character varying(128)`);
        await queryRunner.query(`ALTER TABLE "emoji" ADD "storeAuthorName" character varying(256)`);
    }

    /**
     * @param {QueryRunner} queryRunner
     */
    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "emoji" DROP COLUMN "storeAuthorName"`);
        await queryRunner.query(`ALTER TABLE "emoji" DROP COLUMN "storeAuthorId"`);
        await queryRunner.query(`ALTER TABLE "avatar_decoration" DROP COLUMN "storeAuthorName"`);
        await queryRunner.query(`ALTER TABLE "avatar_decoration" DROP COLUMN "storeAuthorId"`);
    }
}
