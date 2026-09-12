import { MigrationInterface, QueryRunner } from "typeorm";

export class MetadataToAttributes1789113847556 implements MigrationInterface {
    name = 'MetadataToAttributes1789113847556'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "temporary_pages" ("id" varchar PRIMARY KEY NOT NULL, "pageNum" integer NOT NULL, "isActive" boolean NOT NULL, "contentData" blob, "noteId" varchar, "syncedAt" datetime, "userId" varchar NOT NULL, "workspaceId" varchar NOT NULL, "workspaceNoteId" varchar NOT NULL, "syncedId" varchar, "title" varchar, "attributes" text, "contentText" varchar, "contentExtracted" text, "status" varchar DEFAULT ('draft'), CONSTRAINT "FK_8eb51553e685d2ca0053518e460" FOREIGN KEY ("noteId") REFERENCES "notes" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_pages"("id", "pageNum", "isActive", "contentData", "noteId", "syncedAt", "userId", "workspaceId", "workspaceNoteId", "syncedId", "title", "attributes", "contentText", "contentExtracted", "status") SELECT "id", "pageNum", "isActive", "contentData", "noteId", "syncedAt", "userId", "workspaceId", "workspaceNoteId", "syncedId", "title", "metadata", "contentText", "contentExtracted", "status" FROM "pages"`);
        await queryRunner.query(`DROP TABLE "pages"`);
        await queryRunner.query(`ALTER TABLE "temporary_pages" RENAME TO "pages"`);
        await queryRunner.query(`CREATE TABLE "temporary_notes" ("id" varchar PRIMARY KEY NOT NULL, "workspaceId" varchar NOT NULL, "syncedAt" datetime, "userId" varchar NOT NULL, "title" varchar, "content" varchar, "noteDatetime" datetime NOT NULL, "contentType" varchar NOT NULL, "syncedId" varchar, "attributes" text, "status" varchar DEFAULT ('draft'))`);
        await queryRunner.query(`INSERT INTO "temporary_notes"("id", "workspaceId", "syncedAt", "userId", "title", "content", "noteDatetime", "contentType", "syncedId", "attributes", "status") SELECT "id", "workspaceId", "syncedAt", "userId", "title", "content", "noteDatetime", "contentType", "syncedId", "metadata", "status" FROM "notes"`);
        await queryRunner.query(`DROP TABLE "notes"`);
        await queryRunner.query(`ALTER TABLE "temporary_notes" RENAME TO "notes"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "notes" RENAME TO "temporary_notes"`);
        await queryRunner.query(`CREATE TABLE "notes" ("id" varchar PRIMARY KEY NOT NULL, "workspaceId" varchar NOT NULL, "syncedAt" datetime, "userId" varchar NOT NULL, "title" varchar, "content" varchar, "noteDatetime" datetime NOT NULL, "contentType" varchar NOT NULL, "syncedId" varchar, "metadata" text, "status" varchar DEFAULT ('draft'))`);
        await queryRunner.query(`INSERT INTO "notes"("id", "workspaceId", "syncedAt", "userId", "title", "content", "noteDatetime", "contentType", "syncedId", "metadata", "status") SELECT "id", "workspaceId", "syncedAt", "userId", "title", "content", "noteDatetime", "contentType", "syncedId", "attributes", "status" FROM "temporary_notes"`);
        await queryRunner.query(`DROP TABLE "temporary_notes"`);
        await queryRunner.query(`ALTER TABLE "pages" RENAME TO "temporary_pages"`);
        await queryRunner.query(`CREATE TABLE "pages" ("id" varchar PRIMARY KEY NOT NULL, "pageNum" integer NOT NULL, "isActive" boolean NOT NULL, "contentData" blob, "noteId" varchar, "syncedAt" datetime, "userId" varchar NOT NULL, "workspaceId" varchar NOT NULL, "workspaceNoteId" varchar NOT NULL, "syncedId" varchar, "title" varchar, "metadata" text, "contentText" varchar, "contentExtracted" text, "status" varchar DEFAULT ('draft'), CONSTRAINT "FK_8eb51553e685d2ca0053518e460" FOREIGN KEY ("noteId") REFERENCES "notes" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "pages"("id", "pageNum", "isActive", "contentData", "noteId", "syncedAt", "userId", "workspaceId", "workspaceNoteId", "syncedId", "title", "metadata", "contentText", "contentExtracted", "status") SELECT "id", "pageNum", "isActive", "contentData", "noteId", "syncedAt", "userId", "workspaceId", "workspaceNoteId", "syncedId", "title", "attributes", "contentText", "contentExtracted", "status" FROM "temporary_pages"`);
        await queryRunner.query(`DROP TABLE "temporary_pages"`);
    }

}
