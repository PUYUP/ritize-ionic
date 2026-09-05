import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import { getUser } from "../utils/authState";
import { supabase } from '../lib/supabase';

export type NoteFormatTypes = 'text' | 'canvas' | 'file';

export type NoteTypes = {
    readonly id: string;
    readonly created_at: string;
    user_id: string;
    workspace_id: string;
    title: string;
    content_type: NoteFormatTypes;
    content: string; // text extracted from around notes_pages
    note_datetime: string;
    synced_id?: string | null;
    synced_at?: string | null;
    user?: any;
    pages?: NotePageTypes[];
    [key: string]: any;
}

export type NotePageTypes = {
    readonly id: string;
    user_id: string;
    workspace_id: string;
    workspace_note_id: string;
    page_num: number;
    synced_at?: string | null;
    synced_id?: string | null;
    is_active: boolean;
    content_data: Blob;
}

export type PaginatedNotesResponse = {
    notes: NoteTypes[];
    count: number;
}

export type GetNotesByWorkspaceIdParams = {
    workspace_id: string;
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
                        title: body.title,
                        content_type: body.content_type,
                        content: body.content,
                        note_datetime: body.note_datetime,
                        synced_id: body.synced_id,
                        synced_at: body.synced_at,
                    })
                    .select()
                    .single();

                if (error) return { error: { message: error.message } };
                return { data };
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
                            { workspace_id: body.workspace_id as string, page: 1, pageSize: 20 },
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
                                        page_count: [
                                            {
                                                count: 1
                                            }
                                        ],
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
            // invalidatesTags: (result, error) => [{ type: 'Notes', id: 'LIST' }],
        }),

        // ...
        // Upsert single note (insert kalau belum ada, update kalau synced_id sudah ada)
        // ...
        upsertNote: builder.mutation<NoteTypes, { body: Partial<NoteTypes> }>({
            queryFn: async ({ body }) => {
                const user = await getUser();
                if (!user?.id) return { error: { message: "[Upsert Note] User not found" } };
                if (!body.id) return { error: { message: "[Upsert Note] Note ID is required for upsert" } };
                if (!body.workspace_id) return { error: { message: "[Upsert Note] Workspace ID is required" } };
                if (!body.content_type) return { error: { message: "[Upsert Note] Content type is required" } };

                const { data, error } = await supabase
                    .from("workspace_notes")
                    .upsert(body, { onConflict: "id,synced_id" })
                    .select(`
                        *
                        , user!inner(id, name)
                    `)
                    .single();

                if (error) return { error: { message: error.message } };
                return { data };
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
                            { workspace_id: body.workspace_id as string, page: 1, pageSize: 20 },
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
                                        page_count: [
                                            {
                                                count: 1
                                            }
                                        ],
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
            // invalidatesTags: (result, error) => [{ type: 'Notes', id: 'LIST' }],
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
        deleteNote: builder.mutation<void, { id: string, workspace_id: string }>({
            queryFn: async ({ id, workspace_id }) => {
                const user = await getUser();
                if (!user?.id) return { error: { message: "User not found" } };

                const { error } = await supabase
                    .from("workspace_notes")
                    .delete()
                    .eq("id", id)
                    .eq("workspace_id", workspace_id);

                if (error) return { error: { message: error.message } };
                return { data: undefined };
            },
            async onQueryStarted({ id, workspace_id }, { dispatch, queryFulfilled }) {
                // Manipulasi cache untuk query 'getNotesByWorkspaceId'
                const patchResult = dispatch(
                    notesAPI.util.updateQueryData(
                        'getNotesByWorkspaceId',
                        // Argumen di sini harus sesuai agar RTK Query menemukan cache-nya.
                        // Karena sebelumnya kita pakai serializeQueryArgs berdasarkan workspace_id, 
                        // isi argumen page bebas (misal 1), yang penting workspace_id cocok.
                        { workspace_id: workspace_id as string, page: 1, pageSize: 20 },
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
                    patchResult.undo();
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

                const { data, error } = await supabase
                    .from("workspace_notes")
                    .select("*, pages:workspace_notes_pages(*)")
                    .eq("id", id)
                    .single();

                if (error) return { error: { message: error.message } };
                return { data };
            },
            providesTags: (result, error, { id }) => [{ type: 'Notes', id }],
        }),

        // ...
        // Get notes by workspace id (paginated)
        // ...
        getNotesByWorkspaceId: builder.query<PaginatedNotesResponse, GetNotesByWorkspaceIdParams>({
            queryFn: async ({ workspace_id, page = 1, pageSize = 20 }) => {
                const user = await getUser();
                if (!user?.id) return { error: { message: "[Get Notes] User not found" } };
                if (!workspace_id) return { error: { message: "[Get Notes] Workspace ID is required" } };

                const from = (page - 1) * pageSize;
                const to = from + pageSize - 1;

                const { data, error, count } = await supabase
                    .from("workspace_notes_list")
                    .select(`
                        *
                        , page_count:workspace_notes_pages(count)
                        , user!inner(id, name)
                        , attachments(*, file:file_id(*))
                        , papers:workspace_notes_papers(id, paper:paper_id(title, pdf_url))
                    `, { count: "exact" })
                    .eq("workspace_id", workspace_id)
                    .order("created_at", { ascending: false })
                    .range(from, to);

                if (error) return { error: { message: error.message } };
                return { data: { notes: data ?? [], count: count ?? 0 } };
            },

            // --- TAMBAHAN UNTUK PAGINASI (APPEND) ---

            // 1. Simpan cache berdasarkan workspace_id saja (abaikan 'page' agar data tergabung)
            serializeQueryArgs: ({ endpointName, queryArgs }) => {
                return `${endpointName}-${queryArgs.workspace_id}`;
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
        // Add note page
        // ...
        insertNotePage: builder.mutation<NotePageTypes, { body: Partial<NotePageTypes> }>({
            queryFn: async ({ body }) => {
                const user = await getUser();
                if (!user?.id) return { error: { message: "[Insert Note Page] User not found" } };
                if (!body.workspace_id) return { error: { message: "[Insert Note Page] Workspace ID is required" } };
                if (!body.workspace_note_id) return { error: { message: "[Insert Note Page] Workspace Note ID is required" } };
                if (body.page_num === undefined || body.page_num === null) return { error: { message: "[Insert Note Page] Page number is required" } };
                // if (!body.content_data) return { error: { message: "Content data is required" } };

                const { data, error } = await supabase
                    .from("workspace_notes_pages")
                    .insert({
                        user_id: user.id,
                        workspace_id: body.workspace_id,
                        workspace_note_id: body.workspace_note_id,
                        page_num: body.page_num,
                        is_active: body.is_active ?? true,
                        content_data: body.content_data,
                        synced_id: body.synced_id,
                        synced_at: body.synced_at,
                    })
                    .select()
                    .single();

                if (error) return { error: { message: error.message } };
                return { data };
            },
            async onQueryStarted({ body }, { dispatch, queryFulfilled }) {
                // Manipulasi cache untuk query 'getNotesByWorkspaceId'
                const patchResult = dispatch(
                    notesAPI.util.updateQueryData(
                        'getNotesByWorkspaceId',
                        // Argumen di sini harus sesuai agar RTK Query menemukan cache-nya.
                        // Karena sebelumnya kita pakai serializeQueryArgs berdasarkan workspace_id, 
                        // isi argumen page bebas (misal 1), yang penting workspace_id cocok.
                        { workspace_id: body.workspace_id as string, page: 1, pageSize: 20 },
                        (draft) => {
                            // Cari note yang sedang diupdate di dalam array cache
                            const noteIndex = draft.notes.findIndex((n) => n.id === body.workspace_note_id);
                            if (noteIndex !== -1) {
                                // Timpa data lama dengan data baru (patch)
                                draft.notes[noteIndex].page_count[0].count += 1;
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
                    patchResult.undo();
                }
            },
            // invalidatesTags: (result, error) => [
            //     { type: 'NotePages', id: 'LIST' },
            //     { type: 'Notes', id: 'LIST' }
            // ],
        }),

        // ...
        // Upsert single note page (insert kalau belum ada, update kalau synced_id sudah ada)
        // ...
        upsertNotePage: builder.mutation<NotePageTypes, { body: Partial<NotePageTypes> }>({
            queryFn: async ({ body }) => {
                const user = await getUser();
                if (!user?.id) return { error: { message: "[Upsert Note Page] User not found" } };
                if (!body.id) return { error: { message: "[Upsert Note Page] Page ID is required for upsert" } };
                if (!body.workspace_id) return { error: { message: "[Upsert Note Page] Workspace ID is required" } };
                if (!body.workspace_note_id) return { error: { message: "[Upsert Note Page] Workspace Note ID is required" } };
                if (body.page_num === undefined || body.page_num === null) return { error: { message: "[Upsert Note Page] Page number is required" } };
                // if (!body.content_data) return { error: { message: "Content data is required" } };

                const { data, error } = await supabase
                    .from("workspace_notes_pages")
                    .upsert(body, { onConflict: "id,synced_id" })
                    .select()
                    .single();

                if (error) return { error: { message: error.message } };
                return { data };
            },
            async onQueryStarted({ body }, { dispatch, queryFulfilled }) {
                // Manipulasi cache untuk query 'getNotesByWorkspaceId'
                const patchResult = dispatch(
                    notesAPI.util.updateQueryData(
                        'getNotesByWorkspaceId',
                        // Argumen di sini harus sesuai agar RTK Query menemukan cache-nya.
                        // Karena sebelumnya kita pakai serializeQueryArgs berdasarkan workspace_id, 
                        // isi argumen page bebas (misal 1), yang penting workspace_id cocok.
                        { workspace_id: body.workspace_id as string, page: 1, pageSize: 20 },
                        (draft) => {
                            // Cari note yang sedang diupdate di dalam array cache
                            const noteIndex = draft.notes.findIndex((n) => n.id === body.workspace_note_id);
                            if (noteIndex !== -1) {
                                const contentType = draft.notes[noteIndex].content_type;

                                if (contentType === 'text') {
                                    const newContent = ((body.content_data as any)?.ops ?? [])
                                        .map((op: any) => op.insert ?? "")
                                        .join("");

                                    // Timpa data lama dengan data baru (patch)
                                    draft.notes[noteIndex].content_preview = newContent !== '' ? newContent : draft.notes[noteIndex].content_preview;
                                }
                            }
                        }
                    )
                );

                try {
                    // Tunggu sampai proses update ke database selesai
                    const { data } = await queryFulfilled;
                } catch {
                    // Jika gagal update ke server, kembalikan tampilan UI seperti semula (Undo)
                    patchResult.undo();
                }
            },
            // invalidatesTags: (result, error, { body }) => [
            //     ...(body.workspace_note_id ? [{ type: 'Notes' as const, id: body.workspace_note_id }] : []),
            //     { type: 'NotePages', id: 'LIST' },
            //     { type: 'Notes', id: 'LIST' }
            // ],
        }),

        // ...
        // Bulk upsert note pages — untuk sync banyak page lokal ke server sekaligus
        // ...
        upsertNotePages: builder.mutation<NotePageTypes[], { pages: Partial<NotePageTypes>[] }>({
            queryFn: async ({ pages }) => {
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
            // invalidatesTags: [
            //     { type: 'NotePages', id: 'LIST' },
            //     { type: 'Notes', id: 'LIST' }
            // ],
        }),

        // ...
        // Delete note page
        // ...
        deleteNotePage: builder.mutation<void, { synced_id: string, workspace_id: string, workspace_note_id: string }>({
            queryFn: async ({ synced_id, workspace_id, workspace_note_id }) => {
                const { error } = await supabase
                    .from("workspace_notes_pages")
                    .delete()
                    .eq("workspace_id", workspace_id)
                    .eq("workspace_note_id", workspace_note_id)
                    .eq("synced_id", synced_id);

                if (error) return { error: { message: error.message } };
                return { data: undefined };
            },
            async onQueryStarted({ synced_id, workspace_id, workspace_note_id }, { dispatch, queryFulfilled }) {
                // Manipulasi cache untuk query 'getNotesByWorkspaceId'
                const patchResult = dispatch(
                    notesAPI.util.updateQueryData(
                        'getNotesByWorkspaceId',
                        // Argumen di sini harus sesuai agar RTK Query menemukan cache-nya.
                        // Karena sebelumnya kita pakai serializeQueryArgs berdasarkan workspace_id, 
                        // isi argumen page bebas (misal 1), yang penting workspace_id cocok.
                        { workspace_id: workspace_id as string, page: 1, pageSize: 20 },
                        (draft) => {
                            // Cari note yang sedang diupdate di dalam array cache
                            const noteIndex = draft.notes.findIndex((n) => n.id === workspace_note_id);
                            if (noteIndex !== -1) {
                                // Timpa data lama dengan data baru (patch)
                                draft.notes[noteIndex].page_count[0].count -= 1;
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
                    patchResult.undo();
                }
            },
            // invalidatesTags: [
            //     { type: 'NotePages', id: 'LIST' },
            //     { type: 'Notes', id: 'LIST' }
            // ],
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
} = notesAPI;