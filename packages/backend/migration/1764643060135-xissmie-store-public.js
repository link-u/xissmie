/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class XissmieStorePublic1764643060135 {
    name = 'XissmieStorePublic1764643060135'

    /**
     * @param {QueryRunner} queryRunner
     */
    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "avatar_decoration" ADD "isPublic" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "emoji" ADD "isPublic" boolean NOT NULL DEFAULT true`);
    }

    /**
     * @param {QueryRunner} queryRunner
     */
    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "emoji" DROP COLUMN "isPublic"`);
        await queryRunner.query(`ALTER TABLE "avatar_decoration" DROP COLUMN "isPublic"`);
    }
}
