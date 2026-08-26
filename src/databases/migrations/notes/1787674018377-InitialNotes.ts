import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialNotes1787674018377 implements MigrationInterface {
    name = 'InitialNotes1787674018377'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "pages" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "pageNum" integer NOT NULL, "isActive" boolean NOT NULL, "noteId" integer)`);
        await queryRunner.query(`CREATE TABLE "notes" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "workspaceId" varchar NOT NULL)`);
        await queryRunner.query(`CREATE TABLE "temporary_pages" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "pageNum" integer NOT NULL, "isActive" boolean NOT NULL, "noteId" integer, CONSTRAINT "FK_8eb51553e685d2ca0053518e460" FOREIGN KEY ("noteId") REFERENCES "notes" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_pages"("id", "pageNum", "isActive", "noteId") SELECT "id", "pageNum", "isActive", "noteId" FROM "pages"`);
        await queryRunner.query(`DROP TABLE "pages"`);
        await queryRunner.query(`ALTER TABLE "temporary_pages" RENAME TO "pages"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "pages" RENAME TO "temporary_pages"`);
        await queryRunner.query(`CREATE TABLE "pages" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "pageNum" integer NOT NULL, "isActive" boolean NOT NULL, "noteId" integer)`);
        await queryRunner.query(`INSERT INTO "pages"("id", "pageNum", "isActive", "noteId") SELECT "id", "pageNum", "isActive", "noteId" FROM "temporary_pages"`);
        await queryRunner.query(`DROP TABLE "temporary_pages"`);
        await queryRunner.query(`DROP TABLE "notes"`);
        await queryRunner.query(`DROP TABLE "pages"`);
    }

}
