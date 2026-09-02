import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import { getUser } from "../utils/authState";
import { supabase } from "../utils/supabaseClient";

export type NoteFormatTypes = 'text' | 'canvas' | 'image' | 'audio';

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
                if (!user?.id) return { error: { message: "User not found" } };
                if (!body.workspace_id) return { error: { message: "Workspace ID is required" } };
                if (!body.content_type) return { error: { message: "Content type is required" } };

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
            invalidatesTags: (result, error) => [{ type: 'Notes', id: 'LIST' }],
        }),

        // ...
        // Upsert single note (insert kalau belum ada, update kalau synced_id sudah ada)
        // ...
        upsertNote: builder.mutation<NoteTypes, { body: Partial<NoteTypes> }>({
            queryFn: async ({ body }) => {
                const user = await getUser();
                if (!user?.id) return { error: { message: "User not found" } };
                if (!body.id) return { error: { message: "Note ID is required for upsert" } };
                if (!body.workspace_id) return { error: { message: "Workspace ID is required" } };
                if (!body.content_type) return { error: { message: "Content type is required" } };

                const { data, error } = await supabase
                    .from("workspace_notes")
                    .upsert(
                        {
                            id: body.id,
                            user_id: user.id,
                            workspace_id: body.workspace_id,
                            title: body.title,
                            content_type: body.content_type,
                            content: body.content,
                            note_datetime: body.note_datetime,
                            synced_id: body.synced_id,
                            synced_at: body.synced_at,
                        },
                        { onConflict: "synced_id" }
                    )
                    .select()
                    .single();

                if (error) return { error: { message: error.message } };
                return { data };
            },
            invalidatesTags: (result, error) => [{ type: 'Notes', id: 'LIST' }],
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

                const payload = notes.map((note) => ({
                    id: note.id,
                    user_id: user.id,
                    workspace_id: note.workspace_id,
                    title: note.title,
                    content_type: note.content_type,
                    content: note.content,
                    note_datetime: note.note_datetime,
                    synced_id: note.synced_id,
                    synced_at: note.synced_at,
                }));

                const { data, error } = await supabase
                    .from("workspace_notes")
                    .upsert(payload, { onConflict: "synced_id" })
                    .select();

                if (error) return { error: { message: error.message } };
                return { data };
            },
            invalidatesTags: [{ type: 'Notes', id: 'LIST' }],
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
                if (!user?.id) return { error: { message: "User not found" } };
                if (!workspace_id) return { error: { message: "Workspace ID is required" } };

                const from = (page - 1) * pageSize;
                const to = from + pageSize - 1;

                const { data, error, count } = await supabase
                    .from("workspace_notes")
                    .select("*, pages:workspace_notes_pages(count), user!inner(id, name)", { count: "exact" })
                    .eq("workspace_id", workspace_id)
                    .order("created_at", { ascending: false })
                    .range(from, to);

                if (error) return { error: { message: error.message } };
                return { data: { notes: data ?? [], count: count ?? 0 } };
            },
            providesTags: (result) =>
                result
                    ? [
                        ...result.notes.map(({ id }) => ({ type: 'Notes' as const, id })),
                        { type: 'Notes', id: 'LIST' },
                    ]
                    : [{ type: 'Notes', id: 'LIST' }],
        }),

        // ...
        // Add note page
        // ...
        insertNotePage: builder.mutation<NotePageTypes, { body: Partial<NotePageTypes> }>({
            queryFn: async ({ body }) => {
                const user = await getUser();
                if (!user?.id) return { error: { message: "User not found" } };
                if (!body.workspace_id) return { error: { message: "Workspace ID is required" } };
                if (!body.workspace_note_id) return { error: { message: "Workspace Note ID is required" } };
                if (body.page_num === undefined || body.page_num === null) return { error: { message: "Page number is required" } };
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
            invalidatesTags: (result, error) => [{ type: 'NotePages', id: 'LIST' }],
        }),

        // ...
        // Upsert single note page (insert kalau belum ada, update kalau synced_id sudah ada)
        // ...
        upsertNotePage: builder.mutation<NotePageTypes, { body: Partial<NotePageTypes> }>({
            queryFn: async ({ body }) => {
                const user = await getUser();
                if (!user?.id) return { error: { message: "User not found" } };
                if (!body.id) return { error: { message: "Page ID is required for upsert" } };
                if (!body.workspace_id) return { error: { message: "Workspace ID is required" } };
                if (!body.workspace_note_id) return { error: { message: "Workspace Note ID is required" } };
                if (body.page_num === undefined || body.page_num === null) return { error: { message: "Page number is required" } };
                // if (!body.content_data) return { error: { message: "Content data is required" } };

                const { data, error } = await supabase
                    .from("workspace_notes_pages")
                    .upsert(
                        {
                            id: body.id,
                            user_id: user.id,
                            workspace_id: body.workspace_id,
                            workspace_note_id: body.workspace_note_id,
                            page_num: body.page_num,
                            is_active: body.is_active ?? true,
                            content_data: body.content_data,
                            synced_id: body.synced_id,
                            synced_at: body.synced_at,
                        },
                        { onConflict: "synced_id" }
                    )
                    .select()
                    .single();

                if (error) return { error: { message: error.message } };
                return { data };
            },
            invalidatesTags: (result, error) => [{ type: 'NotePages', id: 'LIST' }],
        }),

        // ...
        // Bulk upsert note pages — untuk sync banyak page lokal ke server sekaligus
        // ...
        upsertNotePages: builder.mutation<NotePageTypes[], { pages: Partial<NotePageTypes>[] }>({
            queryFn: async ({ pages }) => {
                const user = await getUser();
                if (!user?.id) return { error: { message: "User not found" } };
                if (!pages?.length) return { error: { message: "No pages to sync" } };

                for (const page of pages) {
                    if (!page.id) return { error: { message: "Every page must have an id for upsert" } };
                    if (!page.workspace_id) return { error: { message: `Workspace ID is required (page id: ${page.id})` } };
                    if (!page.workspace_note_id) return { error: { message: `Workspace Note ID is required (page id: ${page.id})` } };
                    if (page.page_num === undefined || page.page_num === null) return { error: { message: `Page number is required (page id: ${page.id})` } };
                    // if (!page.content_data) return { error: { message: `Content data is required (page id: ${page.id})` } };
                }

                const payload = pages.map((page) => ({
                    id: page.id,
                    user_id: user.id,
                    workspace_id: page.workspace_id,
                    workspace_note_id: page.workspace_note_id,
                    page_num: page.page_num,
                    is_active: page.is_active ?? true,
                    content_data: page.content_data,
                    synced_id: page.synced_id,
                    synced_at: page.synced_at,
                }));

                const { data, error } = await supabase
                    .from("workspace_notes_pages")
                    .upsert(payload, { onConflict: "synced_id" })
                    .select();

                if (error) return { error: { message: error.message } };
                return { data };
            },
            invalidatesTags: [{ type: 'NotePages', id: 'LIST' }],
        }),

        // ...
        // Delete note page
        // ...
        deleteNotePage: builder.mutation<void, { synced_id: string }>({
            queryFn: async ({ synced_id }) => {
                const { error } = await supabase
                    .from("workspace_notes_pages")
                    .delete()
                    .eq("synced_id", synced_id);

                if (error) return { error: { message: error.message } };
                return { data: undefined };
            },
            invalidatesTags: [{ type: 'NotePages', id: 'LIST' }],
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
} = notesAPI;