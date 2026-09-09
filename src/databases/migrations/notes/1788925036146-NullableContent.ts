import { MigrationInterface, QueryRunner } from "typeorm";

export class NullableContent1788925036146 implements MigrationInterface {
    name = 'NullableContent1788925036146'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "temporary_notes" ("id" varchar PRIMARY KEY NOT NULL, "workspaceId" varchar NOT NULL, "syncedAt" datetime, "userId" varchar NOT NULL, "title" varchar, "content" varchar, "noteDatetime" datetime NOT NULL, "contentType" varchar NOT NULL, "syncedId" varchar, "metadata" text, "status" varchar DEFAULT ('draft'))`);
        await queryRunner.query(`INSERT INTO "temporary_notes"("id", "workspaceId", "syncedAt", "userId", "title", "content", "noteDatetime", "contentType", "syncedId", "metadata", "status") SELECT "id", "workspaceId", "syncedAt", "userId", "title", "content", "noteDatetime", "contentType", "syncedId", "metadata", "status" FROM "notes"`);
        await queryRunner.query(`DROP TABLE "notes"`);
        await queryRunner.query(`ALTER TABLE "temporary_notes" RENAME TO "notes"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "notes" RENAME TO "temporary_notes"`);
        await queryRunner.query(`CREATE TABLE "notes" ("id" varchar PRIMARY KEY NOT NULL, "workspaceId" varchar NOT NULL, "syncedAt" datetime, "userId" varchar NOT NULL, "title" varchar NOT NULL, "content" varchar NOT NULL, "noteDatetime" datetime NOT NULL, "contentType" varchar NOT NULL, "syncedId" varchar, "metadata" text, "status" varchar DEFAULT ('draft'))`);
        await queryRunner.query(`INSERT INTO "notes"("id", "workspaceId", "syncedAt", "userId", "title", "content", "noteDatetime", "contentType", "syncedId", "metadata", "status") SELECT "id", "workspaceId", "syncedAt", "userId", "title", "content", "noteDatetime", "contentType", "syncedId", "metadata", "status" FROM "temporary_notes"`);
        await queryRunner.query(`DROP TABLE "temporary_notes"`);
    }

}
