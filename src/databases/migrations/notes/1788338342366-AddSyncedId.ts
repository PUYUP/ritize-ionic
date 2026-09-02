import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSyncedId1788338342366 implements MigrationInterface {
    name = 'AddSyncedId1788338342366'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "temporary_pages" ("id" varchar PRIMARY KEY NOT NULL, "pageNum" integer NOT NULL, "isActive" boolean NOT NULL, "contentData" blob, "noteId" varchar, "syncedAt" datetime, "userId" varchar NOT NULL, "workspaceId" varchar NOT NULL, "workspaceNoteId" varchar NOT NULL, "syncedId" varchar, CONSTRAINT "FK_8eb51553e685d2ca0053518e460" FOREIGN KEY ("noteId") REFERENCES "notes" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_pages"("id", "pageNum", "isActive", "contentData", "noteId", "syncedAt", "userId", "workspaceId", "workspaceNoteId") SELECT "id", "pageNum", "isActive", "contentData", "noteId", "syncedAt", "userId", "workspaceId", "workspaceNoteId" FROM "pages"`);
        await queryRunner.query(`DROP TABLE "pages"`);
        await queryRunner.query(`ALTER TABLE "temporary_pages" RENAME TO "pages"`);
        await queryRunner.query(`CREATE TABLE "temporary_notes" ("id" varchar PRIMARY KEY NOT NULL, "workspaceId" varchar NOT NULL, "syncedAt" datetime, "userId" varchar NOT NULL, "title" varchar NOT NULL, "content" varchar NOT NULL, "noteDatetime" datetime NOT NULL, "contentType" varchar NOT NULL, "syncedId" varchar)`);
        await queryRunner.query(`INSERT INTO "temporary_notes"("id", "workspaceId", "syncedAt", "userId", "title", "content", "noteDatetime", "contentType") SELECT "id", "workspaceId", "syncedAt", "userId", "title", "content", "noteDatetime", "contentType" FROM "notes"`);
        await queryRunner.query(`DROP TABLE "notes"`);
        await queryRunner.query(`ALTER TABLE "temporary_notes" RENAME TO "notes"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "notes" RENAME TO "temporary_notes"`);
        await queryRunner.query(`CREATE TABLE "notes" ("id" varchar PRIMARY KEY NOT NULL, "workspaceId" varchar NOT NULL, "syncedAt" datetime, "userId" varchar NOT NULL, "title" varchar NOT NULL, "content" varchar NOT NULL, "noteDatetime" datetime NOT NULL, "contentType" varchar NOT NULL)`);
        await queryRunner.query(`INSERT INTO "notes"("id", "workspaceId", "syncedAt", "userId", "title", "content", "noteDatetime", "contentType") SELECT "id", "workspaceId", "syncedAt", "userId", "title", "content", "noteDatetime", "contentType" FROM "temporary_notes"`);
        await queryRunner.query(`DROP TABLE "temporary_notes"`);
        await queryRunner.query(`ALTER TABLE "pages" RENAME TO "temporary_pages"`);
        await queryRunner.query(`CREATE TABLE "pages" ("id" varchar PRIMARY KEY NOT NULL, "pageNum" integer NOT NULL, "isActive" boolean NOT NULL, "contentData" blob, "noteId" varchar, "syncedAt" datetime, "userId" varchar NOT NULL, "workspaceId" varchar NOT NULL, "workspaceNoteId" varchar NOT NULL, CONSTRAINT "FK_8eb51553e685d2ca0053518e460" FOREIGN KEY ("noteId") REFERENCES "notes" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "pages"("id", "pageNum", "isActive", "contentData", "noteId", "syncedAt", "userId", "workspaceId", "workspaceNoteId") SELECT "id", "pageNum", "isActive", "contentData", "noteId", "syncedAt", "userId", "workspaceId", "workspaceNoteId" FROM "temporary_pages"`);
        await queryRunner.query(`DROP TABLE "temporary_pages"`);
    }

}
