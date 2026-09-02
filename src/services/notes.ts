import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import { getUser } from "../utils/authState";
import { supabase } from "../utils/supabaseClient";

export type NoteFormatTypes = 'text' | 'canvas' | 'image' | 'audio';

export type NoteTypes = {
    readonly id: string;
    user_id: string;
    workspace_id: string;
    title: string;
    content_type: NoteFormatTypes;
    content: string; // text extracted from around notes_pages
    note_datetime: string;
}

export type NotePageTypes = {
    readonly id: string;
    user_id: string;
    workspace_id: string;
    workspace_note_id: string;
    page_num: number;
    synced_at?: string;
    is_active: boolean;
    content_data: Blob;
}


export const notesAPI = createApi({
    reducerPath: 'notesAPI',
    baseQuery: fakeBaseQuery<{ message: string }>(),
    tagTypes: ['Notes'],
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
                    })
                    .select()
                    .single();

                if (error) return { error: { message: error.message } };
                return { data };
            },
            invalidatesTags: (result, error) => [{ type: 'Notes', id: 'LIST' }],
        }),
    })
});

export const { useInsertNoteMutation } = notesAPI;