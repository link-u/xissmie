/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class XissmieStore1758601428132 {
    name = 'XissmieStore1758601428132'

    /**
     * @param {QueryRunner} queryRunner
     */
    async up(queryRunner) {
        await queryRunner.query(`CREATE TABLE "user_owned_avatar_decoration" ("id" character varying(32) NOT NULL, "purchasedAt" TIMESTAMP WITH TIME ZONE NOT NULL, "userId" character varying(32) NOT NULL, "avatarDecorationId" character varying(32) NOT NULL, CONSTRAINT "PK_5129d5d3cd2cbeab01913d3caf7" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_43a1abdbceb3617f704ef81622" ON "user_owned_avatar_decoration" ("userId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_bec2e880fa0b9f1e4425982ff0" ON "user_owned_avatar_decoration" ("userId", "avatarDecorationId") `);
        await queryRunner.query(`CREATE TABLE "user_owned_emoji" ("id" character varying(32) NOT NULL, "purchasedAt" TIMESTAMP WITH TIME ZONE NOT NULL, "userId" character varying(32) NOT NULL, "emojiId" character varying(32) NOT NULL, CONSTRAINT "PK_85efed2da717bd4696764ac4f78" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_0513491cd69ea545778429d2d2" ON "user_owned_emoji" ("userId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_2a6d4921c964cbec3934d85ee7" ON "user_owned_emoji" ("userId", "emojiId") `);
        await queryRunner.query(`ALTER TABLE "avatar_decoration" ADD "isInStore" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "emoji" ADD "isInStore" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "user_owned_avatar_decoration" ADD CONSTRAINT "FK_43a1abdbceb3617f704ef81622c" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_owned_avatar_decoration" ADD CONSTRAINT "FK_2ae170e7a45450b08e93ec8e3e4" FOREIGN KEY ("avatarDecorationId") REFERENCES "avatar_decoration"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_owned_emoji" ADD CONSTRAINT "FK_0513491cd69ea545778429d2d28" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_owned_emoji" ADD CONSTRAINT "FK_018bd36a19f97e321dfecbea8e3" FOREIGN KEY ("emojiId") REFERENCES "emoji"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    /**
     * @param {QueryRunner} queryRunner
     */
    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "user_owned_emoji" DROP CONSTRAINT "FK_018bd36a19f97e321dfecbea8e3"`);
        await queryRunner.query(`ALTER TABLE "user_owned_emoji" DROP CONSTRAINT "FK_0513491cd69ea545778429d2d28"`);
        await queryRunner.query(`ALTER TABLE "user_owned_avatar_decoration" DROP CONSTRAINT "FK_2ae170e7a45450b08e93ec8e3e4"`);
        await queryRunner.query(`ALTER TABLE "user_owned_avatar_decoration" DROP CONSTRAINT "FK_43a1abdbceb3617f704ef81622c"`);
        await queryRunner.query(`ALTER TABLE "emoji" DROP COLUMN "isInStore"`);
        await queryRunner.query(`ALTER TABLE "avatar_decoration" DROP COLUMN "isInStore"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2a6d4921c964cbec3934d85ee7"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0513491cd69ea545778429d2d2"`);
        await queryRunner.query(`DROP TABLE "user_owned_emoji"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_bec2e880fa0b9f1e4425982ff0"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_43a1abdbceb3617f704ef81622"`);
        await queryRunner.query(`DROP TABLE "user_owned_avatar_decoration"`);
    }
}
