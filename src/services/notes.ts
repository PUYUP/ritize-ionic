import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import { getUser } from "../utils/authState";
import { supabase } from '../lib/supabase';
import NotesRepository from '../databases/datasources/NotesRepository';
import { Note, Page } from '../databases/entities/notes';
import { format } from 'date-fns';

export type NoteFormatTypes = 'text' | 'canvas' | 'file';

export type NoteTypes = {
    readonly id: string;
    readonly created_at: string;
    user_id: string;
    workspace_id: string;
    learning_session_id: string | null;
    title: string;
    content_type: NoteFormatTypes;
    content: string; // text extracted from around notes_pages
    note_datetime: string;
    synced_id?: string | null;
    synced_at?: string | null;
    user?: any;
    pages?: NotePageTypes[];
    status?: 'draft' | 'published';
    processing_status?: 'pending' | 'processed';
    [key: string]: any;
}

export type NotePageTypes = {
    readonly id: string;
    user_id: string;
    workspace_id: string;
    workspace_note_id: string;
    learning_session_id: string | null;
    page_num: number;
    title?: string | null;
    synced_at?: string | null;
    synced_id?: string | null;
    created_at?: string | null;
    is_active: boolean;
    content_data: Blob;
    content_text?: string;
    content_extracted?: Record<string, any> | Array<any> | any | null;
    attributes?: any;
    status?: 'draft' | 'published';
    processing_status?: 'pending' | 'processed';
    attachments?: any;
}

export type PaginatedNotesResponse = {
    notes: NoteTypes[];
    count: number;
}

export type GetNotesByWorkspaceIdParams = {
    workspace_id?: string;
    learning_session_id?: string;
    page?: number;      // default 1
    pageSize?: number;  // default 20
}


export const notesAPI = createApi({
    reducerPath: 'notesAPI',
    baseQuery: fakeBaseQuery<{ message: string }>(),
    tagTypes: ['Notes', 'NotePages'],
    endpoints: (builder) => ({
        // ...
        // Add note
        // ...
        insertNote: builder.mutation<NoteTypes, { body: Partial<NoteTypes> }>({
            queryFn: async ({ body }) => {
                const user = await getUser();
                if (!user?.id) return { error: { message: "[Insert Note] User not found" } };
                if (!body.workspace_id) return { error: { message: "[Insert Note] Workspace ID is required" } };
                if (!body.content_type) return { error: { message: "[Insert Note] Content type is required" } };

                const { data, error } = await supabase
                    .from("workspace_notes")
                    .insert({
                        user_id: user.id,
                        workspace_id: body.workspace_id,
                        learning_session_id: body.learning_session_id,
                        title: body.title,
                        content_type: body.content_type,
                        content: body.content,
                        note_datetime: body.note_datetime,
                        synced_id: body.synced_id,
                        synced_at: body.synced_at,
                        status: body.status,
                        processing_status: body.processing_status,
                    })
                    .select(`
                        *
                        , user!inner(id, name)
                        , documents:workspace_notes_documents(
                            id
                            , similarity_score
                            , document_content
                            , paper_id
                            , paper:paper_id(
                                title
                                , pdf_url
                            )
                        )
                        , chunks:workspace_notes_chunks(clustered_date)
                    `)
                    .limit(2, { foreignTable: "documents" })
                    .limit(1, { foreignTable: "workspace_notes_chunks" })
                    .single();

                if (error) return { error: { message: error.message } };
                return { data: data };
            },
            async onQueryStarted({ body }, { dispatch, queryFulfilled }) {
                // Manipulasi cache untuk query 'getNotesByWorkspaceId'
                let patchResult: any;
                try {
                    // Tunggu sampai proses update ke database selesai
                    const { data } = await queryFulfilled;

                    patchResult = dispatch(
                        notesAPI.util.updateQueryData(
                            'getNotesByWorkspaceId',
                            // Argumen di sini harus sesuai agar RTK Query menemukan cache-nya.
                            // Karena sebelumnya kita pakai serializeQueryArgs berdasarkan workspace_id, 
                            // isi argumen page bebas (misal 1), yang penting workspace_id cocok.
                            {
                                workspace_id: body.workspace_id as string,
                                learning_session_id: body.learning_session_id as string,
                                page: 1,
                                pageSize: 20
                            },
                            (draft) => {
                                // Cari note yang sedang diupdate di dalam array cache
                                const noteIndex = draft.notes.findIndex((n) => n.id === body.id);
                                if (noteIndex !== -1) {
                                    // Update existing note
                                    draft.notes[noteIndex] = {
                                        ...draft.notes[noteIndex],
                                        ...data,
                                    };
                                } else {
                                    // Add new note at the beginning (most recent)
                                    draft.notes.unshift({
                                        ...data,
                                        page_count: 1,
                                    });
                                }
                            }
                        )
                    );
                } catch {
                    // Jika gagal update ke server, kembalikan tampilan UI seperti semula (Undo)
                    if (patchResult) patchResult.undo();
                }
            },
        }),

        // ...
        // Upsert single note (insert kalau belum ada, update kalau synced_id sudah ada)
        // ...
        upsertNote: builder.mutation<NoteTypes, { body: Partial<NoteTypes>, syncToServer?: boolean }>({
            queryFn: async ({ body, syncToServer = true }) => {
                const user = await getUser();
                if (!user?.id) return { error: { message: "[Upsert Note] User not found" } };
                if (!body.id) return { error: { message: "[Upsert Note] Note ID is required for upsert" } };
                if (!body.workspace_id) return { error: { message: "[Upsert Note] Workspace ID is required" } };
                if (!body.content_type) return { error: { message: "[Upsert Note] Content type is required" } };

                if (!syncToServer) {
                    return { data: body };
                }

                const { data, error } = await supabase
                    .from("workspace_notes_list")
                    .upsert(body, { onConflict: "id,synced_id" })
                    .select(`
                        *
                        , pages:workspace_notes_pages(
                            id
                            , learning_session_id
                            , synced_id
                            , synced_at
                            , status 
                            , content_text
                            , processing_status
                            , attachments(*, file:file_id(*))
                        )
                        , user!inner(id, name)
                        , documents:workspace_notes_documents(
                            id
                            , similarity_score
                            , document_content
                            , paper_id
                            , paper:paper_id(
                                title
                                , pdf_url
                            )
                        )
                        , chunks:workspace_notes_chunks(clustered_date)
                        , workspace:workspace_id!inner(
                            title
                            , scope
                            , workspace_members!inner(user_id)
                        )
                    `)
                    .limit(2, { foreignTable: "documents" })
                    .limit(1, { foreignTable: "workspace_notes_chunks" })
                    .single();

                if (error) return { error: { message: error.message } };
                return { data: data };
            },
            async onQueryStarted({ body }, { dispatch, queryFulfilled }) {
                // Manipulasi cache untuk query 'getNotesByWorkspaceId'
                let patchResult: any;
                try {
                    // Tunggu sampai proses update ke database selesai
                    const { data } = await queryFulfilled;

                    patchResult = dispatch(
                        notesAPI.util.updateQueryData(
                            'getNotesByWorkspaceId',
                            // Argumen di sini harus sesuai agar RTK Query menemukan cache-nya.
                            // Karena sebelumnya kita pakai serializeQueryArgs berdasarkan workspace_id, 
                            // isi argumen page bebas (misal 1), yang penting workspace_id cocok.
                            {
                                workspace_id: body.workspace_id as string,
                                learning_session_id: body.learning_session_id as string,
                                page: 1,
                                pageSize: 20
                            },
                            (draft) => {
                                // Cari note yang sedang diupdate di dalam array cache
                                const noteIndex = draft.notes.findIndex((n) => n.id === body.id);
                                if (noteIndex !== -1) {
                                    // Update existing note
                                    draft.notes[noteIndex] = {
                                        ...draft.notes[noteIndex],
                                        content_preview: data.content,
                                        pages_status: data.pages?.some(p => p.status === 'draft') ? 'draft' : 'published',
                                    };
                                } else {
                                    // Add new note at the beginning (most recent)
                                    draft.notes.unshift({
                                        ...data,
                                        content_preview: data.content,
                                        page_count: 1,
                                        pages_status: 'draft',
                                    });
                                }
                            }
                        )
                    );
                } catch {
                    // Jika gagal update ke server, kembalikan tampilan UI seperti semula (Undo)
                    if (patchResult) patchResult.undo();
                }
            },
        }),

        // ...
        // Bulk upsert notes — untuk sync banyak note lokal ke server sekaligus
        // ...
        upsertNotes: builder.mutation<NoteTypes[], { notes: Partial<NoteTypes>[] }>({
            queryFn: async ({ notes }) => {
                const user = await getUser();
                if (!user?.id) return { error: { message: "User not found" } };
                if (!notes?.length) return { error: { message: "No notes to sync" } };

                for (const note of notes) {
                    if (!note.id) return { error: { message: "Every note must have an id for upsert" } };
                    if (!note.workspace_id) return { error: { message: `Workspace ID is required (note id: ${note.id})` } };
                    if (!note.content_type) return { error: { message: `Content type is required (note id: ${note.id})` } };
                }

                const payload = notes.map((note) => ({ ...note }));

                const { data, error } = await supabase
                    .from("workspace_notes")
                    .upsert(payload, { onConflict: "id,synced_id" })
                    .select();

                if (error) return { error: { message: error.message } };
                return { data };
            },
            invalidatesTags: [{ type: 'Notes', id: 'LIST' }],
        }),

        // ...
        // Delete note
        // ...
        deleteNote: builder.mutation<void, { id: string, workspace_id: string, learning_session_id?: string, syncToServer?: boolean }>({
            queryFn: async ({ id, workspace_id, learning_session_id, syncToServer = true }) => {
                const user = await getUser();
                if (!user?.id) return { error: { message: "User not found" } };

                if (!syncToServer) {
                    return { data: undefined };
                }

                const { error } = await supabase
                    .from("workspace_notes")
                    .delete()
                    .eq("id", id)
                    .eq("workspace_id", workspace_id);

                if (error) return { error: { message: error.message } };
                return { data: undefined };
            },
            async onQueryStarted({ id, workspace_id, learning_session_id, syncToServer }, { dispatch, queryFulfilled }) {
                // Manipulasi cache untuk query 'getNotesByWorkspaceId'
                const patchResult = dispatch(
                    notesAPI.util.updateQueryData(
                        'getNotesByWorkspaceId',
                        // Argumen di sini harus sesuai agar RTK Query menemukan cache-nya.
                        // Karena sebelumnya kita pakai serializeQueryArgs berdasarkan workspace_id, 
                        // isi argumen page bebas (misal 1), yang penting workspace_id cocok.
                        {
                            workspace_id: workspace_id as string,
                            learning_session_id: learning_session_id as string,
                            page: 1,
                            pageSize: 20
                        },
                        (draft) => {
                            draft.notes = draft.notes.filter((note) => note.id !== id);
                        }
                    )
                );

                try {
                    // Tunggu sampai proses update ke database selesai
                    const { data } = await queryFulfilled;

                    // (Opsional) Jika database mengembalikan data yang lebih lengkap (misal timestamp format baru),
                    // Anda bisa update lagi draft-nya di sini (Pessimistic Update).
                } catch {
                    // Jika gagal update ke server, kembalikan tampilan UI seperti semula (Undo)
                    if (patchResult) patchResult.undo();
                }
            },
        }),

        // ...
        // Get single note by id
        // ...
        getNoteById: builder.query<NoteTypes, { id: string }>({
            queryFn: async ({ id }) => {
                const user = await getUser();
                if (!user?.id) return { error: { message: "User not found" } };
                if (!id) return { error: { message: "Note ID is required" } };

                let { data, error } = await supabase
                    .from("workspace_notes_list")
                    .select(`
                        *
                        , pages:workspace_notes_pages(*)
                        , user!inner(id, name)
                        , attachments(*, file:file_id(*))
                        , documents:workspace_notes_documents(
                            id
                            , similarity_score
                            , document_content
                            , paper_id
                            , paper:paper_id(
                                title
                                , pdf_url
                            )
                        )
                        , chunks:workspace_notes_chunks(clustered_date)
                        , workspace:workspace_id!inner(
                            title
                            , scope
                            , workspace_members!inner(user_id)
                        )
                    `)
                    .eq("id", id)
                    .limit(2, { foreignTable: "documents" })
                    .limit(1, { foreignTable: "workspace_notes_chunks" })
                    .single();

                if (error) return { error: { message: error.message } };

                if (data) {
                    const seen = new Set<string>();
                    data = {
                        ...data,
                        clustered_date: data.chunks?.[0]?.clustered_date ?? null,
                        documents: (data.documents ?? [])
                            .filter((doc: any) => {
                                if (seen.has(doc.paper_id)) return false;
                                seen.add(doc.paper_id);
                                return true;
                            })
                            .slice(0, 2)
                    }
                }

                return { data };
            },
        }),

        // ...
        // Get notes by workspace id (paginated)
        // ...
        getNotesByWorkspaceId: builder.query<PaginatedNotesResponse, GetNotesByWorkspaceIdParams>({
            queryFn: async ({ workspace_id, learning_session_id, page = 1, pageSize = 20 }) => {
                const user = await getUser();
                if (!user?.id) return { error: { message: "[Get Notes] User not found" } };

                const from = (page - 1) * pageSize;
                const to = from + pageSize - 1;

                let query = supabase
                    .from("workspace_notes_list")
                    .select(`
                        *
                        , pages:workspace_notes_pages(
                            id
                            , learning_session_id
                            , synced_id
                            , synced_at
                            , status 
                            , content_text
                            , processing_status
                            , page_num
                            , content_extracted
                            , attachments(*, file:file_id(*))
                        )
                        , user!inner(id, name)
                        , documents:workspace_notes_documents(
                            id
                            , similarity_score
                            , document_content
                            , paper_id
                            , paper:paper_id(
                                title
                                , pdf_url
                            )
                        )
                        , chunks:workspace_notes_chunks(clustered_date)
                        , workspace:workspace_id!inner(
                            title
                            , scope
                            , workspace_members!inner(user_id)
                        )
                    `, { count: "exact" });

                // first level filter by members
                query = query.eq("workspace.workspace_members.user_id", user.id);

                // second level by workspace
                if (learning_session_id) {
                    query = query.eq("learning_session_id", learning_session_id);
                }

                if (workspace_id) {
                    query = query.eq("workspace_id", workspace_id);
                }

                let { data, error, count } = await query
                    .order("created_at", { ascending: false })
                    .order("page_num", { referencedTable: "pages", ascending: false })
                    .limit(2, { foreignTable: "documents" })
                    .limit(1, { foreignTable: "workspace_notes_chunks" })
                    .range(from, to);

                if (error) {
                    // PGRST103 / HTTP 416 berarti range halaman habis (sudah halaman terakhir)
                    // Kembalikan array kosong agar cache RTK Query tetap berstatus 'fulfilled'
                    if (error.code === 'PGRST103' || error.message.includes("range")) {
                        return { data: { notes: [], count: count ?? 0 } };
                    }
                    return { error: { message: error.message } };
                }

                if (data) {
                    let pagesDraft: NotePageTypes[] = [];
                    let notesDraft: NoteTypes[] = [];

                    if (learning_session_id) {
                        const _pagesDraft = await NotesRepository.getUnsyncedPagesBySessionId(learning_session_id);
                        pagesDraft = _pagesDraft.map(p => {
                            let objString = null;
                            if (p.contentData) {
                                const decoder = new TextDecoder('utf-8');
                                const jsonString = decoder.decode(p.contentData);
                                objString = jsonString ? JSON.parse(jsonString) : {};
                            }

                            return {
                                id: p.id,
                                workspace_id: p.workspaceId,
                                workspace_note_id: p.workspaceNoteId,
                                learning_session_id: p.learningSessionId,
                                synced_id: p.syncedId,
                                attachments: [],
                                processing_status: p.processingStatus,
                                status: p.status,
                                page_num: p.pageNum,
                                content_text: p.contentText || "",
                                user_id: p.userId,
                                is_active: p.isActive,
                                content_data: objString,
                                content_extracted: p.contentExtracted || null,
                            }
                        });

                        const _notesDraft = await NotesRepository.getUnsyncedNotesBySessionId(learning_session_id);
                        if (_notesDraft) {
                            notesDraft = _notesDraft.map((note: Note) => {
                                const draftedPages = pagesDraft.filter(d => d.workspace_note_id === note.id);
                                return {
                                    id: note.id,
                                    user_id: note.userId,
                                    workspace_id: note.workspaceId,
                                    learning_session_id: note.learningSessionId,
                                    content: note.content,
                                    note_datetime: note.noteDatetime ? new Date(note.noteDatetime).toISOString() : format(new Date(), 'yyyy-MM-dd HH:mm:ss.SSS'),
                                    content_type: note.contentType as NoteFormatTypes,
                                    synced_id: note.syncedId,
                                    content_preview: note.content,
                                    status: note.status,
                                    processing_status: note.processingStatus,
                                    created_at: note.createdAt ? new Date(note.createdAt).toISOString() : new Date().toISOString(),
                                    title: note.title,
                                    pages: draftedPages,
                                }
                            });
                        }
                    }

                    const seen = new Set<string>();
                    data = ([...notesDraft, ...(data ?? [])])
                        .map((note: any) => {
                            if (!note.documents) return note;
                            const draftedPages = pagesDraft.filter(d => d.workspace_note_id === note.id);

                            return {
                                ...note,
                                page_count: note.pages.length || 0,
                                pages_status: note.pages.some((page: any) => page.status === "draft") ? "draft" : "published",
                                clustered_date: note.chunks?.[0]?.clustered_date ?? null,
                                pages: [...draftedPages, ...note.pages],
                                documents: note.documents
                                    .filter((doc: any) => {
                                        if (seen.has(doc.paper_id)) return false;
                                        seen.add(doc.paper_id);
                                        return true;
                                    })
                                    .slice(0, 2),
                            }
                        });
                }

                return { data: { notes: data ?? [], count: count ?? 0 } };
            },

            // --- TAMBAHAN UNTUK PAGINASI (APPEND) ---

            // 1. Simpan cache berdasarkan learning_session_id saja (abaikan 'page' agar data tergabung)
            serializeQueryArgs: ({ endpointName, queryArgs }) => {
                return `${endpointName}-${queryArgs.workspace_id}-${queryArgs.learning_session_id}`;
            },

            // 2. Gabungkan data baru ke data lama
            merge: (currentCache, newItems, { arg }) => {
                if (arg.page === 1) {
                    // Jika memuat ulang dari halaman 1, timpa / reset cache lama
                    currentCache.notes = newItems.notes;
                    currentCache.count = newItems.count;
                } else {
                    // Jika halaman 2 dan seterusnya, APPEND data ke array 'notes'
                    currentCache.notes.push(...newItems.notes);
                    currentCache.count = newItems.count; // Update count terbaru
                }
            },

            // 3. Wajibkan refetch setiap kali nomor 'page' berubah
            forceRefetch({ currentArg, previousArg }) {
                return currentArg?.page !== previousArg?.page;
            },

            // ----------------------------------------

            providesTags: (result) =>
                result
                    ? [
                        ...result.notes.map(({ id }) => ({ type: 'Notes' as const, id })),
                        { type: 'Notes', id: 'LIST' },
                        { type: 'NotePages', id: 'LIST' }
                    ]
                    : [
                        { type: 'Notes', id: 'LIST' },
                        { type: 'NotePages', id: 'LIST' }
                    ],
        }),

        // ...
        // Get single page by id
        // ...
        getPageById: builder.query<NotePageTypes, { id: string }>({
            queryFn: async ({ id }) => {
                const user = await getUser();
                if (!user?.id) return { error: { message: "User not found" } };
                if (!id) return { error: { message: "Page ID is required" } };

                const { data, error } = await supabase
                    .from("workspace_notes_pages")
                    .select("*")
                    .eq("id", id)
                    .single();

                if (error) return { error: { message: error.message } };
                return { data: data };
            },
        }),

        // ...
        // Add note page
        // ...
        insertNotePage: builder.mutation<NotePageTypes, { body: Partial<NotePageTypes>, syncToServer?: boolean }>({
            queryFn: async ({ body, syncToServer = true }) => {
                const user = await getUser();
                if (!user?.id) return { error: { message: "[Insert Note Page] User not found" } };
                if (!body.workspace_id) return { error: { message: "[Insert Note Page] Workspace ID is required" } };
                if (!body.workspace_note_id) return { error: { message: "[Insert Note Page] Workspace Note ID is required" } };
                if (body.page_num === undefined || body.page_num === null) return { error: { message: "[Insert Note Page] Page number is required" } };
                // if (!body.content_data) return { error: { message: "Content data is required" } };

                if (!syncToServer) {
                    return { data: body as NotePageTypes };
                }

                const { data, error } = await supabase
                    .from("workspace_notes_pages")
                    .insert(body)
                    .select()
                    .single();

                if (error) return { error: { message: error.message } };
                return { data: data! };
            },
            async onQueryStarted({ body, syncToServer }, { dispatch, queryFulfilled }) {
                // Manipulasi cache untuk query 'getNotesByWorkspaceId'
                const patchResult = dispatch(
                    notesAPI.util.updateQueryData(
                        'getNotesByWorkspaceId',
                        // Argumen di sini harus sesuai agar RTK Query menemukan cache-nya.
                        // Karena sebelumnya kita pakai serializeQueryArgs berdasarkan workspace_id, 
                        // isi argumen page bebas (misal 1), yang penting workspace_id cocok.
                        {
                            workspace_id: body.workspace_id as string,
                            learning_session_id: body.learning_session_id as string,
                            page: 1,
                            pageSize: 20
                        },
                        (draft) => {
                            // Cari note yang sedang diupdate di dalam array cache
                            const noteIndex = draft.notes.findIndex((n) => n.id === body.workspace_note_id);
                            if (noteIndex !== -1) {
                                // Timpa data lama dengan data baru (patch)
                                draft.notes[noteIndex].page_count += 1;
                                draft.notes[noteIndex].documents = [];
                                draft.notes[noteIndex].pages_status = body?.status || 'draft';

                                // masukkan draft pages
                                draft.notes[noteIndex].pages = [body as NotePageTypes, ...(draft.notes[noteIndex].pages || [])];
                            }
                        }
                    )
                );

                try {
                    // Tunggu sampai proses update ke database selesai
                    const { data } = await queryFulfilled;

                    // (Opsional) Jika database mengembalikan data yang lebih lengkap (misal timestamp format baru),
                    // Anda bisa update lagi draft-nya di sini (Pessimistic Update).
                } catch {
                    // Jika gagal update ke server, kembalikan tampilan UI seperti semula (Undo)
                    if (patchResult) patchResult.undo();
                }
            },
        }),

        // ...
        // Upsert single note page (insert kalau belum ada, update kalau synced_id sudah ada)
        // ...
        upsertNotePage: builder.mutation<NotePageTypes, { body: Partial<NotePageTypes>, syncToServer?: boolean }>({
            queryFn: async ({ body, syncToServer = true }) => {
                const user = await getUser();
                if (!user?.id) return { error: { message: "[Upsert Note Page] User not found" } };
                if (!body.id) return { error: { message: "[Upsert Note Page] Page ID is required for upsert" } };
                if (!body.workspace_id) return { error: { message: "[Upsert Note Page] Workspace ID is required" } };
                if (!body.workspace_note_id) return { error: { message: "[Upsert Note Page] Workspace Note ID is required" } };
                if (body.page_num === undefined || body.page_num === null) return { error: { message: "[Upsert Note Page] Page number is required" } };
                // if (!body.content_data) return { error: { message: "Content data is required" } };

                if (!syncToServer) {
                    return { data: body as NotePageTypes };
                }

                const { data, error } = await supabase
                    .from("workspace_notes_pages")
                    .upsert(body, { onConflict: "id,synced_id" })
                    .select()
                    .single();

                if (error) return { error: { message: error.message } };
                return { data: data };
            },
            async onQueryStarted({ body }, { dispatch, queryFulfilled }) {
                // Manipulasi cache untuk query 'getNotesByWorkspaceId'
                let patchResult = dispatch(
                    notesAPI.util.updateQueryData(
                        'getNotesByWorkspaceId',
                        // Argumen di sini harus sesuai agar RTK Query menemukan cache-nya.
                        // Karena sebelumnya kita pakai serializeQueryArgs berdasarkan workspace_id, 
                        // isi argumen page bebas (misal 1), yang penting workspace_id cocok.
                        {
                            workspace_id: body.workspace_id as string,
                            learning_session_id: body.learning_session_id as string,
                            page: 1,
                            pageSize: 20
                        },
                        (draft) => {
                            // Cari note yang sedang diupdate di dalam array cache
                            const noteIndex = draft.notes.findIndex((n) => n.id === body.workspace_note_id);
                            if (noteIndex !== -1) {
                                const contentType = draft.notes[noteIndex].content_type;
                                const documents = draft.notes[noteIndex].documents;

                                if (contentType === 'text') {
                                    const newContent = ((body.content_data as any)?.ops ?? [])
                                        .map((op: any) => op.insert ?? "")
                                        .join("");

                                    // Timpa data lama dengan data baru (patch)
                                    draft.notes[noteIndex].content_preview = newContent !== '' ? newContent : draft.notes[noteIndex].content_preview;
                                    draft.notes[noteIndex].documents = documents ? documents : [];
                                }
                            }
                        }
                    )
                );

                try {
                    // Tunggu sampai proses update ke database selesai
                    const { data } = await queryFulfilled;

                    patchResult = dispatch(
                        notesAPI.util.updateQueryData(
                            'getNotesByWorkspaceId',
                            // Argumen di sini harus sesuai agar RTK Query menemukan cache-nya.
                            // Karena sebelumnya kita pakai serializeQueryArgs berdasarkan workspace_id, 
                            // isi argumen page bebas (misal 1), yang penting workspace_id cocok.
                            {
                                workspace_id: body.workspace_id as string,
                                learning_session_id: body.learning_session_id as string,
                                page: 1,
                                pageSize: 20
                            },
                            (draft) => {
                                // Cari note yang sedang diupdate di dalam array cache
                                const noteIndex = draft.notes.findIndex((n) => n.id === body.workspace_note_id);
                                if (noteIndex !== -1) {
                                    const contentType = draft.notes[noteIndex].content_type;
                                    const pages = draft.notes[noteIndex].pages || [];

                                    if (contentType === 'file') {
                                        if (Object.hasOwn(data.attributes, 'file')) {
                                            const attributes = data.attributes;

                                            draft.notes[noteIndex].pages = [
                                                ...pages,
                                                {
                                                    ...data,
                                                    attachments: [
                                                        {
                                                            id: attributes.attachment.id,
                                                            file: {
                                                                id: attributes.file.id,
                                                                media_link: attributes.file.media_link,
                                                            }
                                                        }
                                                    ]
                                                }
                                            ];
                                        }
                                    }
                                }
                            }
                        )
                    );
                } catch {
                    // Jika gagal update ke server, kembalikan tampilan UI seperti semula (Undo)
                    if (patchResult) patchResult.undo();
                }
            },
        }),

        // ...
        // Bulk upsert note pages — untuk sync banyak page lokal ke server sekaligus
        // ...
        upsertNotePages: builder.mutation<NotePageTypes[], { pages: Partial<NotePageTypes>[], syncToServer?: boolean }>({
            queryFn: async ({ pages, syncToServer = true }) => {
                if (!syncToServer) {
                    return { data: pages }
                }

                const user = await getUser();
                if (!user?.id) return { error: { message: "[Upsert Note Pages] User not found" } };
                if (!pages?.length) return { error: { message: "[Upsert Note Pages] No pages to sync" } };

                for (const page of pages) {
                    if (!page.id) return { error: { message: "[Upsert Note Pages] Every page must have an id for upsert" } };
                    if (!page.workspace_id) return { error: { message: `[Upsert Note Pages] Workspace ID is required (page id: ${page.id})` } };
                    if (!page.workspace_note_id) return { error: { message: `[Upsert Note Pages] Workspace Note ID is required (page id: ${page.id})` } };
                    if (page.page_num === undefined || page.page_num === null) return { error: { message: `[Upsert Note Pages] Page number is required (page id: ${page.id})` } };
                }

                const payload = pages.map((page) => ({ ...page }));

                const { data, error } = await supabase
                    .from("workspace_notes_pages")
                    .upsert(payload, { onConflict: "id,synced_id" })
                    .select();

                if (error) return { error: { message: error.message } };
                return { data };
            },
            async onQueryStarted({ pages }, { dispatch, queryFulfilled, getState }) {
                // Manipulasi cache untuk query 'getNotesByWorkspaceId'
                let patchResult: any;

                try {
                    const { data } = await queryFulfilled;

                    const firstPage = pages[0];
                    const workspaceId = firstPage.workspace_id;
                    const workspaceNoteId = firstPage.workspace_note_id;
                    const learningSessionId = firstPage.learning_session_id;

                    patchResult = dispatch(
                        notesAPI.util.updateQueryData(
                            'getNotesByWorkspaceId',
                            // Argumen di sini harus sesuai agar RTK Query menemukan cache-nya.
                            // Karena sebelumnya kita pakai serializeQueryArgs berdasarkan workspace_id, 
                            // isi argumen page bebas (misal 1), yang penting workspace_id cocok.
                            {
                                workspace_id: workspaceId as string,
                                learning_session_id: learningSessionId as string,
                                page: 1,
                                pageSize: 20
                            },
                            (draft) => {
                                // Cari note yang sedang diupdate di dalam array cache
                                const noteIndex = draft.notes.findIndex((n) => n.id === workspaceNoteId);
                                if (noteIndex === -1) return;

                                draft.notes[noteIndex].pages_status = data.some((p) => p.status === 'draft') ? 'draft' : 'published';

                                // update pages
                                if (draft.notes[noteIndex].pages) {
                                    draft.notes[noteIndex].pages = draft.notes[noteIndex].pages.map(page => {
                                        const newPage = data.find((p) => p.id === page.id);
                                        return {
                                            ...page,
                                            ...(newPage ? newPage : {}),
                                        }
                                    });
                                }
                            }
                        )
                    );

                } catch {
                    // Jika gagal update ke server, kembalikan tampilan UI seperti semula (Undo)
                    patchResult.undo();
                }
            },
        }),

        // ...
        // Update single page
        // ...
        microUpdateNotePage: builder.mutation<NotePageTypes, { id: string, syncToServer?: boolean, data: Partial<NotePageTypes> }>({
            queryFn: async ({ id, syncToServer, data }) => {
                if (!syncToServer) {
                    return { data }
                }

                const user = await getUser();
                if (!user?.id) return { error: { message: "[Update Note Page] User not found" } };

                const { data: updatedData, error } = await supabase
                    .from("workspace_notes_pages")
                    .update(data)
                    .eq("id", id)
                    .select(`
                        *
                        , attachments(*, file:file_id(*))
                    `)
                    .single();

                if (error) return { error: { message: error.message } };
                return { data: updatedData };
            },
            async onQueryStarted({ id, data }, { dispatch, queryFulfilled }) {
                // Manipulasi cache untuk query 'getNotesByWorkspaceId'
                let patchResult = dispatch(
                    notesAPI.util.updateQueryData(
                        'getNotesByWorkspaceId',
                        // Argumen di sini harus sesuai agar RTK Query menemukan cache-nya.
                        // Karena sebelumnya kita pakai serializeQueryArgs berdasarkan workspace_id, 
                        // isi argumen page bebas (misal 1), yang penting workspace_id cocok.
                        {
                            workspace_id: data.workspace_id as string,
                            learning_session_id: data.learning_session_id as string,
                            page: 1,
                            pageSize: 20
                        },
                        (draft) => {
                            // Cari note yang sedang diupdate di dalam array cache
                            const noteIndex = draft.notes.findIndex((n) => n.id === data.workspace_note_id);
                            if (noteIndex !== -1) {
                                draft.notes[noteIndex].pages_status = data.status;
                                if (draft.notes[noteIndex].pages) {
                                    const pageIndex = draft.notes[noteIndex].pages.findIndex((p) => p.id === data.id);
                                    if (pageIndex !== -1) {
                                        draft.notes[noteIndex].pages[pageIndex] = {
                                            ...draft.notes[noteIndex].pages[pageIndex],
                                            ...data,
                                            content_text: data.content_text,
                                        };
                                    } else {
                                        draft.notes[noteIndex].pages.unshift(data as NotePageTypes);
                                    }
                                }
                            }
                        }
                    )
                );

                try {
                    const { data } = await queryFulfilled;

                    patchResult = dispatch(
                        notesAPI.util.updateQueryData(
                            'getNotesByWorkspaceId',
                            // Argumen di sini harus sesuai agar RTK Query menemukan cache-nya.
                            // Karena sebelumnya kita pakai serializeQueryArgs berdasarkan workspace_id, 
                            // isi argumen page bebas (misal 1), yang penting workspace_id cocok.
                            {
                                workspace_id: data.workspace_id as string,
                                learning_session_id: data.learning_session_id as string,
                                page: 1,
                                pageSize: 20
                            },
                            (draft) => {
                                // Cari note yang sedang diupdate di dalam array cache
                                const noteIndex = draft.notes.findIndex((n) => n.id === data.workspace_note_id);
                                if (noteIndex !== -1) {
                                    draft.notes[noteIndex].pages_status = data.status;
                                    if (draft.notes[noteIndex].pages) {
                                        const pageIndex = draft.notes[noteIndex].pages.findIndex((p) => p.id === data.id);
                                        if (pageIndex !== -1) {
                                            draft.notes[noteIndex].pages[pageIndex] = {
                                                ...draft.notes[noteIndex].pages[pageIndex],
                                                ...data,
                                                content_text: data.content_text,
                                            };
                                        } else {
                                            draft.notes[noteIndex].pages.unshift(data as NotePageTypes);
                                        }
                                    }
                                }
                            }
                        )
                    );

                } catch {
                    // Jika gagal update ke server, kembalikan tampilan UI seperti semula (Undo)
                    if (patchResult) patchResult.undo();
                }
            },
        }),

        // ...
        // Delete note page
        // ...
        deleteNotePage: builder.mutation<void, { page_id: string, workspace_id: string, workspace_note_id: string, learning_session_id: string, syncToServer?: boolean }>({
            queryFn: async ({ page_id, workspace_id, workspace_note_id, learning_session_id, syncToServer = true }) => {
                if (!syncToServer) {
                    return { data: undefined };
                }

                const { error } = await supabase
                    .from("workspace_notes_pages")
                    .delete()
                    .eq("workspace_id", workspace_id)
                    .eq("workspace_note_id", workspace_note_id)
                    .eq("id", page_id);

                if (error) return { error: { message: error.message } };
                return { data: undefined };
            },
            async onQueryStarted({ page_id, workspace_id, workspace_note_id, learning_session_id }, { dispatch, queryFulfilled }) {
                // Manipulasi cache untuk query 'getNotesByWorkspaceId'
                const patchResult = dispatch(
                    notesAPI.util.updateQueryData(
                        'getNotesByWorkspaceId',
                        // Argumen di sini harus sesuai agar RTK Query menemukan cache-nya.
                        // Karena sebelumnya kita pakai serializeQueryArgs berdasarkan workspace_id, 
                        // isi argumen page bebas (misal 1), yang penting workspace_id cocok.
                        {
                            workspace_id: workspace_id as string,
                            learning_session_id: learning_session_id as string,
                            page: 1,
                            pageSize: 20
                        },
                        (draft) => {
                            const noteIndex = draft.notes.findIndex((n) => n.id === workspace_note_id);
                            if (noteIndex === -1) return;
                            const note = draft.notes[noteIndex];

                            if (!Array.isArray(note.pages)) return; // jangan decrement kalau pages gak ada di cache ini

                            const found = note.pages.some((page) => String(page.id) === String(page_id));
                            if (!found) return; // page_id gak match apapun, jangan decrement

                            note.pages = note.pages
                                .filter((page) => String(page.id) !== String(page_id))
                                .map((p, idx) => ({ ...p, page_num: idx + 1 }));
                            note.page_count -= 1;
                        }
                    )
                );

                try {
                    // Tunggu sampai proses update ke database selesai
                    const { data } = await queryFulfilled;

                    // (Opsional) Jika database mengembalikan data yang lebih lengkap (misal timestamp format baru),
                    // Anda bisa update lagi draft-nya di sini (Pessimistic Update).
                } catch {
                    // Jika gagal update ke server, kembalikan tampilan UI seperti semula (Undo)
                    if (patchResult) patchResult.undo();
                }
            },
        })
    })
});

export const {
    useInsertNoteMutation,
    useUpsertNoteMutation,
    useUpsertNotesMutation,
    useInsertNotePageMutation,
    useUpsertNotePageMutation,
    useUpsertNotePagesMutation,
    useGetNotesByWorkspaceIdQuery,
    useGetNoteByIdQuery,
    useLazyGetNoteByIdQuery,
    useMicroUpdateNotePageMutation,
} = notesAPI;