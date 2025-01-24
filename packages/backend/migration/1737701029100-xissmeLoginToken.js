/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class XissmeLoginToken1737701029100 {
    name = 'XissmeLoginToken1737701029100'

    async up(queryRunner) {
        await queryRunner.query(`CREATE TABLE "xissme_login_token" ("id" SERIAL NOT NULL, "userId" character varying(32) NOT NULL, "token" character varying(128) NOT NULL, CONSTRAINT "PK_62a9f03e5fc4194b53548dd05b0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_e989e0e5a1034e747c8a2db4fb" ON "xissme_login_token" ("userId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_707201dbbe7d3f2849462b7ae9" ON "xissme_login_token" ("userId", "token") `);
        await queryRunner.query(`ALTER TABLE "xissme_login_token" ADD CONSTRAINT "FK_e989e0e5a1034e747c8a2db4fbb" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "xissme_login_token" DROP CONSTRAINT "FK_e989e0e5a1034e747c8a2db4fbb"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_707201dbbe7d3f2849462b7ae9"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e989e0e5a1034e747c8a2db4fb"`);
        await queryRunner.query(`DROP TABLE "xissme_login_token"`);
    }
}
