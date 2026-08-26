import { Repository } from 'typeorm';
import notesDataSource from '../datasources/NotesDataSource';
import { Note } from '../entities/notes/notes';
import { Page } from '../entities/notes/pages'; // Sesuaikan path dengan lokasi file Page kamu
import sqliteParams from '../sqliteParams';

class NotesRepository {
    // --------------------------------------------------
    // INITIALIZATION & HELPERS
    // --------------------------------------------------

    private get noteRepo(): Repository<Note> {
        const ds = notesDataSource.dataSource;
        if (!ds.isInitialized) {
            throw new Error("Database belum di-initialize!");
        }
        return ds.getRepository(Note);
    }

    private get pageRepo(): Repository<Page> {
        const ds = notesDataSource.dataSource;
        if (!ds.isInitialized) {
            throw new Error("Database belum di-initialize!");
        }
        return ds.getRepository(Page);
    }

    // Helper untuk auto-save ke IndexedDB jika di Web
    private async saveWebStore() {
        if (sqliteParams.platform === 'web') {
            await sqliteParams.connection.saveToStore('ritize-notes');
        }
    }

    // --------------------------------------------------
    // CRUD UNTUK NOTE
    // --------------------------------------------------

    async getNoteById(id: number): Promise<Note | null> {
        return this.noteRepo.findOne({
            where: { id } as any,
            relations: ['pages'], // Akan otomatis mengambil data child pages
        });
    }

    async getAllNotes(): Promise<Note[]> {
        return this.noteRepo.find({
            relations: ['pages']
        });
    }

    async insertNote(data: Partial<Note>): Promise<Note> {
        const entity = this.noteRepo.create(data);
        const result = await this.noteRepo.save(entity);
        await this.saveWebStore();
        return result;
    }

    async upsertNote(data: Partial<Note>, conflictPaths: string[] = ['id']): Promise<Note | null> {
        const result = await this.noteRepo.upsert(data as any, conflictPaths);
        await this.saveWebStore();
        const insertedId = result.identifiers?.[0]?.id;
        if (insertedId === undefined) return null;
        return this.getNoteById(insertedId);
    }

    async deleteNote(id: number): Promise<boolean> {
        const result = await this.noteRepo.delete(id);
        await this.saveWebStore();
        return (result.affected ?? 0) > 0;
    }

    // --------------------------------------------------
    // CRUD UNTUK PAGE (CHILD)
    // --------------------------------------------------

    /** Tambah Page baru ke sebuah Note */
    async addPage(note: Partial<Note>, data: Partial<Page>): Promise<Page> {
        // Karena relasinya ada pada Note, kita pasangkan id-nya
        const page = this.pageRepo.create({
            ...data,
            note: note
        });

        const result = await this.pageRepo.save(page);
        await this.saveWebStore();
        return result;
    }

    /** Ambil semua Page berdasarkan Note ID */
    async getPagesByNoteId(noteId: number): Promise<Page[]> {
        return this.pageRepo.find({
            // Syntax ini secara otomatis mencari berdasarkan foreign key
            where: {
                note: { id: noteId }
            } as any,
            order: {
                pageNum: 'ASC' // <-- WAJIB: Pastikan selalu terurut berdasarkan pageNum
            } as any,
        });
    }

    /** Ambil 1 Page berdasarkan ID (Jika butuh spesifik 1 page saja) */
    async getPageById(id: number): Promise<Page | null> {
        return this.pageRepo.findOneBy({ id } as any);
    }

    /** Update properti Page (misal update isActive / JSON Canvas) */
    async updatePage(pageId: number, data: Partial<Page>): Promise<Page | null> {
        await this.pageRepo.update(pageId, data as any);
        await this.saveWebStore();
        return this.getPageById(pageId);
    }

    /**
     * Bulk update untuk daftar pages
     */
    async updatePagesBulk(pages: Partial<Page>[]): Promise<Page[]> {
        // save() bisa menerima array objek.
        // Jika objek memiliki `id`, TypeORM otomatis melakukan UPDATE.
        const results: Page[] = [];

        for (let p of pages) {
            if (p.id) {
                const res = await this.updatePage(p.id, p);
                if (res) {
                    results.push(res);
                    // Simpan perubahan ke IndexedDB jika di platform web
                    await this.saveWebStore();
                }
            }
        }

        return results;
    }

    /** Hapus 1 halaman Page */
    async deletePage(pageId: number): Promise<boolean> {
        const result = await this.pageRepo.delete(pageId);
        await this.saveWebStore();
        return (result.affected ?? 0) > 0;
    }
}

export default new NotesRepository();