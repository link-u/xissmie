/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class addStoreProductId1769700000000 {
    name = 'addStoreProductId1769700000000'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "emoji" ADD "storeProductId" character varying(128)`);
        await queryRunner.query(`ALTER TABLE "avatar_decoration" ADD "storeProductId" character varying(128)`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "avatar_decoration" DROP COLUMN "storeProductId"`);
        await queryRunner.query(`ALTER TABLE "emoji" DROP COLUMN "storeProductId"`);
    }
}


