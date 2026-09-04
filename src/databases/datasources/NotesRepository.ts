import { Repository } from 'typeorm';
import notesDataSource from '../datasources/NotesDataSource';
import { Note } from '../entities/notes/notes';
import { Page } from '../entities/notes/pages'; // Sesuaikan path dengan lokasi file Page kamu
import sqliteParams from '../sqliteParams';
import { getUser } from '../../utils/authState';
import { NoteFormatTypes, notesAPI } from '../../services/notes';
import { store } from '../../store';

class NotesRepository {
    // Antrian sederhana: setiap write dijalankan setelah write sebelumnya selesai
    private writeQueue: Promise<unknown> = Promise.resolve();

    private enqueueWrite<T>(fn: () => Promise<T>): Promise<T> {
        const result = this.writeQueue.then(fn, fn); // jalan meski yang sebelumnya reject
        // simpan chain terbaru, tapi jangan biarkan reject mem-break antrian selanjutnya
        this.writeQueue = result.catch(() => { });
        return result;
    }

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

    async getNoteById(id: string): Promise<Note | null> {
        return this.noteRepo.findOne({
            where: { id: id } as any,
            relations: ['pages'], // Akan otomatis mengambil data child pages
        });
    }

    async getAllNotes(): Promise<Note[]> {
        return this.noteRepo.find({
            relations: ['pages']
        });
    }

    async insertNote(data: Partial<Note>): Promise<Note> {
        return this.enqueueWrite(async () => {
            const user = await getUser();
            const entity = this.noteRepo.create({
                ...data,
                userId: user.id,
            });
            const note = await this.noteRepo.save(entity);
            await this.saveWebStore();

            if (note) {
                store
                    .dispatch(notesAPI.endpoints.upsertNote.initiate({
                        body: {
                            id: note.id,
                            workspace_id: note.workspaceId,
                            synced_at: note.syncedAt ? note.syncedAt.toISOString() : new Date().toISOString(),
                            synced_id: note.syncedId,
                            content_type: note.contentType as NoteFormatTypes,
                            content: note.content,
                            note_datetime: note.noteDatetime.toDateString(),
                            title: note.title,
                        }
                    }))
                    .unwrap();
            }

            return note;
        });
    }

    async upsertNote(data: Partial<Note>, conflictPaths: string[] = ['id']): Promise<Note | null> {
        return this.enqueueWrite(async () => {
            const result = await this.noteRepo.upsert(data as any, conflictPaths);
            await this.saveWebStore();
            const insertedId = result.identifiers?.[0]?.id;
            if (insertedId === undefined) return null;

            const note = await this.getNoteById(insertedId);

            if (note) {
                store
                    .dispatch(notesAPI.endpoints.upsertNote.initiate({
                        body: {
                            id: note.id,
                            workspace_id: note.workspaceId,
                            synced_at: note.syncedAt ? note.syncedAt.toISOString() : new Date().toISOString(),
                            synced_id: note.syncedId,
                            content_type: note.contentType as NoteFormatTypes,
                            content: note.content,
                            note_datetime: note.noteDatetime.toDateString(),
                            title: note.title,
                        }
                    }))
                    .unwrap();
            }

            return note;
        });
    }

    async deleteNote(id: string): Promise<boolean> {
        const result = await this.noteRepo.delete(id);
        await this.saveWebStore();
        return (result.affected ?? 0) > 0;
    }

    // --------------------------------------------------
    // CRUD UNTUK PAGE (CHILD)
    // --------------------------------------------------

    /** Tambah Page baru ke sebuah Note */
    async addPage(note: Partial<Note>, data: Partial<Page>): Promise<Page> {
        return this.enqueueWrite(async () => {
            const user = await getUser();
            // Karena relasinya ada pada Note, kita pasangkan id-nya
            const page = this.pageRepo.create({
                ...data,
                userId: user.id,
                // note: note
            });

            const savedPage = await this.pageRepo.save(page);
            await this.saveWebStore();

            if (savedPage) {
                let objString = null;
                if (savedPage.contentData) {
                    const decoder = new TextDecoder('utf-8');
                    const jsonString = decoder.decode(savedPage.contentData);
                    objString = jsonString ? JSON.parse(jsonString) : {};
                }

                store
                    .dispatch(notesAPI.endpoints.upsertNotePage.initiate({
                        body: {
                            id: savedPage.id,
                            user_id: savedPage.userId,
                            workspace_id: savedPage.workspaceId,
                            workspace_note_id: savedPage.workspaceNoteId,
                            synced_at: savedPage.syncedAt ? savedPage.syncedAt.toISOString() : new Date().toISOString(),
                            synced_id: savedPage.syncedId,
                            content_data: objString,
                            page_num: savedPage.pageNum,
                            is_active: savedPage.isActive,
                        }
                    }))
                    .unwrap();
            }

            return savedPage;
        });
    }

    /** Bulk insert beberapa Page baru sekaligus ke dalam satu Note */
    async addPagesBulk(note: Partial<Note>, dataList: Partial<Page>[]): Promise<Page[]> {
        const user = await getUser();

        const pages = dataList.map((data) =>
            this.pageRepo.create({
                ...data,
                userId: user.id,
                note: note,
            })
        );

        const savedPages = await this.pageRepo.save(pages);
        await this.saveWebStore();

        // Sync semua page baru ke server secara paralel
        await Promise.all(
            savedPages.map((savedPage) => {
                let objString = null;
                if (savedPage.contentData) {
                    const decoder = new TextDecoder('utf-8');
                    const jsonString = decoder.decode(savedPage.contentData);
                    objString = jsonString ? JSON.parse(jsonString) : {};
                }

                return store
                    .dispatch(notesAPI.endpoints.upsertNotePage.initiate({
                        body: {
                            id: savedPage.id,
                            user_id: savedPage.userId,
                            workspace_id: savedPage.workspaceId,
                            workspace_note_id: savedPage.workspaceNoteId,
                            synced_at: savedPage.syncedAt ? savedPage.syncedAt.toISOString() : new Date().toISOString(),
                            synced_id: savedPage.syncedId,
                            content_data: objString,
                            page_num: savedPage.pageNum,
                            is_active: savedPage.isActive,
                        }
                    }))
                    .unwrap()
                    .catch((err) => {
                        console.error('Gagal sync page ke server:', savedPage.id, err);
                    });
            })
        );

        return savedPages;
    }

    /** Ambil semua Page berdasarkan Note ID */
    async getPagesByNoteId(noteId: string): Promise<Page[]> {
        return this.pageRepo.find({
            // Syntax ini secara otomatis mencari berdasarkan foreign key
            where: {
                workspaceNoteId: noteId
            } as any,
            order: {
                pageNum: 'ASC' // <-- WAJIB: Pastikan selalu terurut berdasarkan pageNum
            } as any,
        });
    }

    /** Ambil 1 Page berdasarkan ID (Jika butuh spesifik 1 page saja) */
    async getPageById(id: string): Promise<Page | null> {
        return this.pageRepo.findOneBy({ id } as any);
    }

    /** Update properti Page (misal update isActive / JSON Canvas) */
    async updatePage(pageId: string, data: Partial<Page>): Promise<Page | null> {
        return this.enqueueWrite(async () => {
            await this.pageRepo.update(pageId, data as any);
            await this.saveWebStore();

            const savedPage = await this.getPageById(pageId);

            if (savedPage) {
                let objString = null;
                if (savedPage.contentData) {
                    const decoder = new TextDecoder('utf-8');
                    const jsonString = decoder.decode(savedPage.contentData);
                    objString = jsonString ? JSON.parse(jsonString) : {};
                }

                store
                    .dispatch(notesAPI.endpoints.upsertNotePage.initiate({
                        body: {
                            id: savedPage.id,
                            user_id: savedPage.userId,
                            workspace_id: savedPage.workspaceId,
                            workspace_note_id: savedPage.workspaceNoteId,
                            synced_at: savedPage.syncedAt ? savedPage.syncedAt.toISOString() : new Date().toISOString(),
                            synced_id: savedPage.syncedId,
                            content_data: objString,
                            page_num: savedPage.pageNum,
                            is_active: savedPage.isActive,
                        }
                    }))
                    .unwrap();
            }

            return savedPage;
        });
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
    async deletePage(pageId: string, syncedId: string | null = null): Promise<boolean> {
        const result = await this.pageRepo.delete(pageId);
        await this.saveWebStore();

        if (syncedId) {
            store
                .dispatch(notesAPI.endpoints.deleteNotePage.initiate({
                    synced_id: syncedId,
                }))
                .unwrap();
        }

        return (result.affected ?? 0) > 0;
    }
}

export default new NotesRepository();