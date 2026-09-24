import { IsNull, Repository } from 'typeorm';
import notesDataSource from '../datasources/NotesDataSource';
import { Note } from '../entities/notes/notes';
import { Page } from '../entities/notes/pages'; // Sesuaikan path dengan lokasi file Page kamu
import sqliteParams from '../sqliteParams';
import { getUser } from '../../utils/authState';
import { NoteFormatTypes, notesAPI } from '../../services/notes';
import { store } from '../../store';
import { format } from 'date-fns';

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

    private removeEmpty<T extends Record<string, unknown>>(obj: T): Partial<T> {
        return Object.fromEntries(
            Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== '')
        ) as Partial<T>;
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

    async getUnsyncedNotesBySessionId(sessionId: string): Promise<Note[]> {
        return this.noteRepo.find({
            where: { learningSessionId: sessionId, syncedId: IsNull() } as any,
            relations: ['pages'],
        });
    }

    async getUnsyncedPagesBySessionId(sessionId: string): Promise<Page[]> {
        return this.pageRepo.find({
            where: { learningSessionId: sessionId, syncedId: IsNull() } as any,
        });
    }

    async getUnsyncedPagesByNoteId(noteId: string): Promise<Page[]> {
        return this.pageRepo.find({
            where: { workspaceNoteId: noteId, syncedId: IsNull() } as any,
        });
    }

    async getUnsyncedNote(contentType: string = 'text'): Promise<Note | null> {
        return this.noteRepo.findOne({
            where: { syncedId: IsNull(), contentType: contentType } as any,
            relations: ['pages'],
        });
    }

    async insertNote(data: Partial<Note>, syncToServer: boolean = true): Promise<Note> {
        return this.enqueueWrite(async () => {
            const user = await getUser();
            const entity = this.noteRepo.create({
                ...data,
                userId: user.id,
            });
            const note = await this.noteRepo.save(entity);
            await this.saveWebStore();

            if (note) {
                await store
                    .dispatch(notesAPI.endpoints.upsertNote.initiate({
                        syncToServer: syncToServer,
                        body: this.removeEmpty({
                            id: note.id,
                            user_id: user.id,
                            workspace_id: note.workspaceId,
                            learning_session_id: note.learningSessionId,
                            created_at: note.createdAt ? note.createdAt : new Date().toISOString(),
                            synced_at: note.syncedAt ? note.syncedAt : new Date().toISOString(),
                            synced_id: note.syncedId,
                            content_type: note.contentType as NoteFormatTypes,
                            content: note.content,
                            note_datetime: note.noteDatetime ? new Date(note.noteDatetime).toISOString() : new Date().toISOString(),
                            title: note.title,
                            status: note.status,
                            processing_status: note.processingStatus,
                        })
                    }));
            }

            return note;
        });
    }

    async upsertNote(data: Partial<Note>, conflictPaths: string[] = ['id'], syncToServer: boolean = true): Promise<Note | null> {
        return this.enqueueWrite(async () => {
            const user = await getUser();
            const result = await this.noteRepo.upsert(this.removeEmpty(data as any), conflictPaths);
            await this.saveWebStore();
            const insertedId = result.identifiers?.[0]?.id;
            if (insertedId === undefined) return null;

            const note = await this.getNoteById(insertedId);

            if (note) {
                await store
                    .dispatch(notesAPI.endpoints.upsertNote.initiate({
                        syncToServer: syncToServer,
                        body: this.removeEmpty({
                            id: note.id,
                            user_id: user.id,
                            workspace_id: note.workspaceId,
                            learning_session_id: note.learningSessionId,
                            created_at: note.createdAt ? note.createdAt : new Date().toISOString(),
                            synced_at: note.syncedAt ? note.syncedAt : new Date().toISOString(),
                            synced_id: note.syncedId,
                            content_type: note.contentType as NoteFormatTypes,
                            content: note.content,
                            note_datetime: note.noteDatetime ? new Date(note.noteDatetime).toISOString() : new Date().toISOString(),
                            title: note.title,
                            status: note.status,
                            processing_status: note.processingStatus,
                            attributes: note.attributes,
                        })
                    }));
            }

            return note;
        });
    }

    async updateNote(data: Partial<Note>, syncToServer: boolean = true): Promise<Note | null> {
        return this.enqueueWrite(async () => {
            const user = await getUser();
            await this.noteRepo.update(data.id as string, this.removeEmpty(data as any));
            await this.saveWebStore();

            const note = await this.getNoteById(data.id as string);

            if (note && syncToServer) {
                await store
                    .dispatch(notesAPI.endpoints.upsertNote.initiate({
                        body: this.removeEmpty({
                            id: note.id,
                            user_id: user.id,
                            workspace_id: note.workspaceId,
                            learning_session_id: note.learningSessionId,
                            synced_at: note.syncedAt ? note.syncedAt : new Date().toISOString(),
                            synced_id: note.syncedId,
                            content_type: note.contentType as NoteFormatTypes,
                            content: note.content,
                            note_datetime: note.noteDatetime ? new Date(note.noteDatetime).toISOString() : new Date().toISOString(),
                            title: note.title,
                            status: note.status,
                            processing_status: note.processingStatus,
                            attributes: note.attributes,
                        })
                    }))
                    .unwrap();
            }

            return note;
        });
    }

    async deleteNote(id: string, workspaceId: string, learningSessionId: string, syncToServer: boolean = true): Promise<boolean> {
        const result = await this.noteRepo.delete(id);
        await this.saveWebStore();

        // delete from database
        await store.dispatch(notesAPI.endpoints.deleteNote.initiate({
            id: id,
            workspace_id: workspaceId,
            learning_session_id: learningSessionId,
            syncToServer: syncToServer,
        }));

        return (result.affected ?? 0) > 0;
    }

    // --------------------------------------------------
    // CRUD UNTUK PAGE (CHILD)
    // --------------------------------------------------

    /** Tambah Page baru ke sebuah Note */
    async addPage(note: Partial<Note>, data: Partial<Page>, syncToServer: boolean = true): Promise<Page> {
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

                await store
                    .dispatch(notesAPI.endpoints.insertNotePage.initiate({
                        syncToServer: syncToServer,
                        body: this.removeEmpty({
                            id: savedPage.id,
                            user_id: savedPage.userId,
                            workspace_id: savedPage.workspaceId,
                            learning_session_id: savedPage.learningSessionId,
                            workspace_note_id: savedPage.workspaceNoteId,
                            created_at: note.createdAt ? note.createdAt : new Date().toISOString(),
                            synced_at: savedPage.syncedAt ? savedPage.syncedAt : new Date().toISOString(),
                            synced_id: savedPage.syncedId,
                            content_data: objString,
                            content_text: savedPage.contentText ? savedPage.contentText : "",
                            content_extracted: savedPage.contentExtracted ? savedPage.contentExtracted : null,
                            page_num: savedPage.pageNum,
                            title: savedPage.title,
                            is_active: savedPage.isActive,
                            status: savedPage.status,
                            processing_status: savedPage.processingStatus,
                            attributes: note.attributes,
                        })
                    }))
                    .unwrap();
            }

            return savedPage;
        });
    }

    /** Bulk insert beberapa Page baru sekaligus ke dalam satu Note */
    async addPagesBulk(dataList: Partial<Page>[], syncToServer: boolean = true): Promise<Page[]> {
        const user = await getUser();
        const pages = dataList.map((data) =>
            this.pageRepo.create({
                ...data,
                userId: user.id,
                // note: note,
            })
        );

        const savedPages = await this.pageRepo.save(pages);
        await this.saveWebStore();

        // Sync semua page baru ke server secara paralel
        // Bangun payload sync untuk semua page sekaligus
        const updatingPages = savedPages.map((savedPage) => {
            let objString = null;
            if (savedPage.contentData) {
                const decoder = new TextDecoder('utf-8');
                const jsonString = decoder.decode(savedPage.contentData);
                objString = jsonString ? JSON.parse(jsonString) : {};
            }

            return {
                id: savedPage.id,
                user_id: savedPage.userId,
                workspace_id: savedPage.workspaceId,
                learning_session_id: savedPage.learningSessionId,
                workspace_note_id: savedPage.workspaceNoteId,
                synced_at: savedPage.syncedAt ? savedPage.syncedAt : new Date().toISOString(),
                synced_id: savedPage.syncedId,
                content_data: objString,
                content_text: savedPage.contentText ? savedPage.contentText : "",
                content_extracted: savedPage.contentExtracted ? savedPage.contentExtracted : null,
                page_num: savedPage.pageNum,
                title: savedPage.title,
                is_active: savedPage.isActive,
                status: savedPage.status,
                processing_status: savedPage.processingStatus,
            };
        });

        // Kirim satu request bulk ke server, bukan banyak request paralel
        await store
            .dispatch(notesAPI.endpoints.upsertNotePages.initiate({
                pages: updatingPages,
                syncToServer: syncToServer
            }))
            .unwrap()
            .catch((err) => {
                console.error('Gagal sync pages ke server:', err);
            });

        return savedPages;
    }

    /**
     * Bulk upsert untuk daftar pages, mirip upsertNote tapi untuk banyak pages sekaligus.
     * repo.upsert() TypeORM bisa langsung menerima array entity untuk insert/update sekaligus.
     */
    async upsertPagesBulk(
        pages: Partial<Page>[],
        conflictPaths: string[] = ['id'],
        syncToServer: boolean = true
    ): Promise<Page[]> {
        return this.enqueueWrite(async () => {
            const user = await getUser();
            const result = await this.pageRepo.upsert(
                pages.map((p) => this.removeEmpty(p as any)),
                conflictPaths
            );
            await this.saveWebStore();

            // Ambil ulang tiap page (insert baru maupun update) berdasarkan id hasil upsert
            const ids = (result.identifiers ?? [])
                .map((identifier) => identifier?.id)
                .filter((id) => id !== undefined);

            const results: Page[] = [];
            for (const id of ids) {
                const page = await this.getPageById(id);
                if (page) results.push(page);
            }

            if (results.length) {
                const upsertingPages = results.map((page) => {
                    let objString = null;
                    if (page.contentData) {
                        const decoder = new TextDecoder('utf-8');
                        const jsonString = decoder.decode(page.contentData);
                        objString = jsonString ? JSON.parse(jsonString) : {};
                    }

                    return this.removeEmpty({
                        id: page.id,
                        user_id: page.userId ?? user.id,
                        workspace_id: page.workspaceId,
                        workspace_note_id: page.workspaceNoteId,
                        learning_session_id: page.learningSessionId,
                        synced_at: page.syncedAt ? page.syncedAt : new Date().toISOString(),
                        synced_id: page.syncedId,
                        page_num: page.pageNum,
                        title: page.title,
                        is_active: page.isActive,
                        status: page.status,
                        processing_status: page.processingStatus,
                        content_data: objString,
                        content_text: page.contentText ? page.contentText : "",
                        content_extracted: page.contentExtracted ? page.contentExtracted : null,
                        attributes: page.attributes,
                    });
                });

                await store
                    .dispatch(notesAPI.endpoints.upsertNotePages.initiate({
                        pages: upsertingPages,
                        syncToServer: syncToServer
                    }))
                    .unwrap()
                    .catch((err) => {
                        console.error('Gagal sync pages ke server:', err);
                    });
            }

            return results;
        });
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
    async updatePage(pageId: string, data: Partial<Page>, syncToServer: boolean = true): Promise<Page | null> {
        return this.enqueueWrite(async () => {
            // remove property note related to this model
            await this.pageRepo.update(pageId, data as any);
            await this.saveWebStore();

            const savedPage = await this.getPageById(pageId);

            // Update bulk langsung ke supabase jangan 1 per 1
            if (savedPage) {
                let objString = null;
                if (savedPage.contentData) {
                    const decoder = new TextDecoder('utf-8');
                    const jsonString = decoder.decode(savedPage.contentData);
                    objString = jsonString ? JSON.parse(jsonString) : {};
                }

                await store
                    .dispatch(notesAPI.endpoints.upsertNotePage.initiate({
                        syncToServer: syncToServer,
                        body: this.removeEmpty({
                            id: savedPage.id,
                            user_id: savedPage.userId,
                            workspace_id: savedPage.workspaceId,
                            workspace_note_id: savedPage.workspaceNoteId,
                            learning_session_id: savedPage.learningSessionId,
                            synced_at: savedPage.syncedAt ? savedPage.syncedAt : new Date().toISOString(),
                            synced_id: savedPage.syncedId,
                            content_data: objString,
                            content_text: savedPage.contentText ? savedPage.contentText : "",
                            content_extracted: savedPage.contentExtracted ? savedPage.contentExtracted : null,
                            attributes: savedPage.attributes,
                            page_num: savedPage.pageNum,
                            title: savedPage.title,
                            is_active: savedPage.isActive,
                            status: savedPage.status,
                            processing_status: savedPage.processingStatus,
                        })
                    }))
                    .unwrap();
            }

            return savedPage;
        });
    }

    /** Micro update for page only passing value will be procesed */
    async microUpdatePage(pageId: string, data: Partial<Page>, syncToServer: boolean = true): Promise<Page | null> {
        return this.enqueueWrite(async () => {
            // remove property note related to this model
            await this.pageRepo.update(pageId, data as any);
            await this.saveWebStore();

            const savedPage = await this.getPageById(pageId);

            // Update bulk langsung ke supabase jangan 1 per 1
            if (savedPage) {
                let objString = null;
                if (data.contentData) {
                    const decoder = new TextDecoder('utf-8');
                    const jsonString = decoder.decode(data.contentData);
                    objString = jsonString ? JSON.parse(jsonString) : {};
                }

                await store
                    .dispatch(notesAPI.endpoints.microUpdateNotePage.initiate({
                        id: pageId,
                        syncToServer: syncToServer,
                        data: this.removeEmpty({
                            id: data.id,
                            user_id: data.userId,
                            workspace_id: data.workspaceId,
                            workspace_note_id: data.workspaceNoteId,
                            learning_session_id: data.learningSessionId,
                            synced_at: data.syncedAt ? data.syncedAt : new Date().toISOString(),
                            content_data: objString,
                            content_text: data.contentText ? data.contentText : "",
                            content_extracted: data.contentExtracted,
                            page_num: data.pageNum,
                            is_active: data.isActive,
                            status: data.status,
                            processing_status: data.processingStatus,
                        })
                    }))
                    .unwrap();
            }

            return savedPage;
        });
    }

    /**
     * Bulk update untuk daftar pages
     */
    async updatePagesBulk(pages: Partial<Page>[], syncToServer: boolean = true): Promise<Page[]> {
        // save() bisa menerima array objek.
        // Jika objek memiliki `id`, TypeORM otomatis melakukan UPDATE.
        const results: Page[] = [];

        for (let p of pages) {
            if (p.id) {
                const res = await this.updatePage(p.id, p, false);
                if (res) {
                    results.push(res);
                    // Simpan perubahan ke IndexedDB jika di platform web
                    await this.saveWebStore();
                }
            }
        }

        // langsung update ke supabase
        const updatingPages = pages.map((p) => {
            let objString = null;
            if (p.contentData) {
                const decoder = new TextDecoder('utf-8');
                const jsonString = decoder.decode(p.contentData);
                objString = jsonString ? JSON.parse(jsonString) : {};
            }

            return this.removeEmpty({
                id: p.id,
                user_id: p.userId,
                workspace_id: p.workspaceId,
                workspace_note_id: p.workspaceNoteId,
                learning_session_id: p.learningSessionId,
                synced_at: p.syncedAt ? p.syncedAt : new Date().toISOString(),
                synced_id: p.syncedId,
                page_num: p.pageNum,
                title: p.title,
                is_active: p.isActive,
                status: p.status,
                processing_status: p.processingStatus,
                content_data: objString,
                content_text: p.contentText ? p.contentText : "",
                content_extracted: p.contentExtracted ? p.contentExtracted : null,
                attributes: p.attributes,
            })
        });

        await store.dispatch(notesAPI.endpoints.upsertNotePages
            .initiate({
                pages: updatingPages,
                syncToServer: syncToServer
            }))
            .unwrap()
            .catch((err) => {
                console.error('Gagal sync pages ke server:', err);
            });

        return results;
    }

    /** Hapus 1 halaman Page */
    async deletePage({
        pageId,
        workspaceId,
        workspaceNoteId,
        learningSessionId,
        syncToServer = true
    }: {
        pageId: string;
        workspaceId: string;
        workspaceNoteId: string;
        learningSessionId: string;
        syncToServer?: boolean;
    }): Promise<boolean> {
        const result = await this.pageRepo.delete(pageId);
        await this.saveWebStore();

        await store
            .dispatch(notesAPI.endpoints.deleteNotePage.initiate({
                page_id: pageId,
                workspace_id: workspaceId,
                workspace_note_id: workspaceNoteId,
                learning_session_id: learningSessionId,
                syncToServer: syncToServer,
            }))
            .unwrap();

        return (result.affected ?? 0) > 0;
    }
}

export default new NotesRepository();