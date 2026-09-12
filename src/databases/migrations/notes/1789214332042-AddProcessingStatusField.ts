import { MigrationInterface, QueryRunner } from "typeorm";

export class AddProcessingStatusField1789214332042 implements MigrationInterface {
    name = 'AddProcessingStatusField1789214332042'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "temporary_pages" ("id" varchar PRIMARY KEY NOT NULL, "pageNum" integer NOT NULL, "isActive" boolean NOT NULL, "contentData" blob, "noteId" varchar, "syncedAt" datetime, "userId" varchar NOT NULL, "workspaceId" varchar NOT NULL, "workspaceNoteId" varchar NOT NULL, "syncedId" varchar, "title" varchar, "attributes" text, "contentText" varchar, "contentExtracted" text, "status" varchar DEFAULT ('draft'), "processingStatus" varchar DEFAULT ('pending'), CONSTRAINT "FK_8eb51553e685d2ca0053518e460" FOREIGN KEY ("noteId") REFERENCES "notes" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_pages"("id", "pageNum", "isActive", "contentData", "noteId", "syncedAt", "userId", "workspaceId", "workspaceNoteId", "syncedId", "title", "attributes", "contentText", "contentExtracted", "status") SELECT "id", "pageNum", "isActive", "contentData", "noteId", "syncedAt", "userId", "workspaceId", "workspaceNoteId", "syncedId", "title", "attributes", "contentText", "contentExtracted", "status" FROM "pages"`);
        await queryRunner.query(`DROP TABLE "pages"`);
        await queryRunner.query(`ALTER TABLE "temporary_pages" RENAME TO "pages"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "pages" RENAME TO "temporary_pages"`);
        await queryRunner.query(`CREATE TABLE "pages" ("id" varchar PRIMARY KEY NOT NULL, "pageNum" integer NOT NULL, "isActive" boolean NOT NULL, "contentData" blob, "noteId" varchar, "syncedAt" datetime, "userId" varchar NOT NULL, "workspaceId" varchar NOT NULL, "workspaceNoteId" varchar NOT NULL, "syncedId" varchar, "title" varchar, "attributes" text, "contentText" varchar, "contentExtracted" text, "status" varchar DEFAULT ('draft'), CONSTRAINT "FK_8eb51553e685d2ca0053518e460" FOREIGN KEY ("noteId") REFERENCES "notes" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "pages"("id", "pageNum", "isActive", "contentData", "noteId", "syncedAt", "userId", "workspaceId", "workspaceNoteId", "syncedId", "title", "attributes", "contentText", "contentExtracted", "status") SELECT "id", "pageNum", "isActive", "contentData", "noteId", "syncedAt", "userId", "workspaceId", "workspaceNoteId", "syncedId", "title", "attributes", "contentText", "contentExtracted", "status" FROM "temporary_pages"`);
        await queryRunner.query(`DROP TABLE "temporary_pages"`);
    }

}
