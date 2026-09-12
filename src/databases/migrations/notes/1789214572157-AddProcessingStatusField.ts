import { MigrationInterface, QueryRunner } from "typeorm";

export class AddProcessingStatusField1789214572157 implements MigrationInterface {
    name = 'AddProcessingStatusField1789214572157'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "temporary_notes" ("id" varchar PRIMARY KEY NOT NULL, "workspaceId" varchar NOT NULL, "syncedAt" datetime, "userId" varchar NOT NULL, "title" varchar, "content" varchar, "noteDatetime" datetime NOT NULL, "contentType" varchar NOT NULL, "syncedId" varchar, "attributes" text, "status" varchar DEFAULT ('draft'), "processingStatus" varchar DEFAULT ('pending'))`);
        await queryRunner.query(`INSERT INTO "temporary_notes"("id", "workspaceId", "syncedAt", "userId", "title", "content", "noteDatetime", "contentType", "syncedId", "attributes", "status") SELECT "id", "workspaceId", "syncedAt", "userId", "title", "content", "noteDatetime", "contentType", "syncedId", "attributes", "status" FROM "notes"`);
        await queryRunner.query(`DROP TABLE "notes"`);
        await queryRunner.query(`ALTER TABLE "temporary_notes" RENAME TO "notes"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "notes" RENAME TO "temporary_notes"`);
        await queryRunner.query(`CREATE TABLE "notes" ("id" varchar PRIMARY KEY NOT NULL, "workspaceId" varchar NOT NULL, "syncedAt" datetime, "userId" varchar NOT NULL, "title" varchar, "content" varchar, "noteDatetime" datetime NOT NULL, "contentType" varchar NOT NULL, "syncedId" varchar, "attributes" text, "status" varchar DEFAULT ('draft'))`);
        await queryRunner.query(`INSERT INTO "notes"("id", "workspaceId", "syncedAt", "userId", "title", "content", "noteDatetime", "contentType", "syncedId", "attributes", "status") SELECT "id", "workspaceId", "syncedAt", "userId", "title", "content", "noteDatetime", "contentType", "syncedId", "attributes", "status" FROM "temporary_notes"`);
        await queryRunner.query(`DROP TABLE "temporary_notes"`);
    }

}
