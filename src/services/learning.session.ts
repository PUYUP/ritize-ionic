import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import { getUser } from "../utils/authState";
import { supabase } from "../lib/supabase";

export type LearningSessionTypes = {
    readonly id: string;
    readonly workspace: any;
    readonly pages_text: any[];
    readonly pages_canvas: any[];
    readonly pages_file: any[];

    created_at: string;
    started_at: string;
    ended_at: string;
    workspace_id: string;
    user_id: string;
    title: string;
    status: string;
    duration_seconds: number;
}

export type GetLearningSessionsByWorkspaceIdParams = {
    workspace_id?: string;
    page?: number;      // default 1
    pageSize?: number;  // default 20
}

export type PaginatedLearningSessionsResponse = {
    results: LearningSessionTypes[];
    count: number;
}

export const learningSessionAPI = createApi({
    reducerPath: 'learningSessionAPI',
    baseQuery: fakeBaseQuery<{ message: string }>(),
    tagTypes: ['LearningSession'],
    endpoints: (builder) => ({
        // ...
        // add session
        // ...
        createSession: builder.mutation<LearningSessionTypes, { body: Partial<LearningSessionTypes> }>({
            queryFn: async ({ body }) => {
                const user = await getUser();
                if (!user?.id) return { error: { message: "[Create Session] User not found" } };
                if (!body.workspace_id) return { error: { message: "[Create Session] Workspace ID is required" } };

                const { data, error } = await supabase
                    .from("workspace_learning_sessions")
                    .insert({
                        user_id: user.id,
                        workspace_id: body.workspace_id,
                        title: body.title,
                        started_at: body.started_at,
                        ended_at: body.ended_at,
                        duration_seconds: body.duration_seconds,
                        status: body.status,
                    })
                    .select(`
                        *
                        , user:user_id!inner(id, name)
                        , workspace:workspace_id(
                            id
                            , title
                        )
                    `)
                    .single();

                if (error) return { error: { message: error.message } };
                return { data: data };
            },
            async onQueryStarted({ body }, { dispatch, queryFulfilled }) {
                // Kita menunggu hasil server dulu (bukan optimistic update), karena field
                // seperti id/created_at baru ada setelah insert berhasil di Supabase.
                // Karena itu tidak ada apa pun untuk di-undo kalau request-nya gagal.
                try {
                    const { data } = await queryFulfilled;

                    dispatch(
                        learningSessionAPI.util.updateQueryData(
                            'getLearningSessionsByWorkspaceId',
                            // Argumen di sini harus sesuai agar RTK Query menemukan cache-nya.
                            // Karena sebelumnya kita pakai serializeQueryArgs berdasarkan workspace_id, 
                            // isi argumen page bebas (misal 1), yang penting workspace_id cocok.
                            { workspace_id: body.workspace_id as string, page: 1, pageSize: 20 },
                            (draft) => {
                                // Cocokkan pakai id hasil dari server (data.id), bukan body.id,
                                // karena pada create, body.id memang belum ada.
                                const index = draft.results.findIndex((n) => n.id === data.id);
                                if (index !== -1) {
                                    // Update existing session
                                    draft.results[index] = {
                                        ...draft.results[index],
                                        ...data,
                                    };
                                } else {
                                    // Add new session at the beginning (most recent)
                                    draft.results.unshift({
                                        ...data,
                                    });
                                }
                            }
                        )
                    );
                } catch (err) {
                    // Insert gagal di server, cache belum pernah diubah jadi tidak perlu di-undo.
                    console.error('[Create Session] Gagal menyinkronkan session ke cache', err);
                }
            },
        }),

        // ...
        // get learning session by id with full data
        // ...
        getLearningSessionById: builder.query<LearningSessionTypes, string>({
            queryFn: async (id) => {
                const { data, error } = await supabase
                    .from("workspace_learning_sessions")
                    .select(`
                        *
                        , pages_text:workspace_notes_pages(
                            id
                            , note:workspace_note_id!inner(
                                content_type
                            )
                        )
                        , pages_canvas:workspace_notes_pages(
                            id
                            , note:workspace_note_id!inner(
                                content_type
                            )
                        )
                        , pages_file:workspace_notes_pages(
                            id
                            , note:workspace_note_id!inner(
                                content_type
                            )
                        )
                        , workspace:workspace_id!inner(*)
                    `)
                    .eq("id", id)
                    .eq("pages_text.note.content_type", "text")
                    .eq("pages_canvas.note.content_type", "canvas")
                    .eq("pages_file.note.content_type", "file")
                    .single();

                if (error) {
                    return { error: { message: error.message ?? 'Failed to fetch learning session' } };
                }

                return { data: { ...data } };
            },
            providesTags: (result, error, id) => [{ type: 'LearningSession', id }],
        }),

        // ...
        // Get learning sessions by workspace id (paginated)
        // ...
        getLearningSessionsByWorkspaceId: builder.query<PaginatedLearningSessionsResponse, GetLearningSessionsByWorkspaceIdParams>({
            queryFn: async ({ workspace_id, page = 1, pageSize = 20 }) => {
                const user = await getUser();
                if (!user?.id) return { error: { message: "[Get Learning Session] User not found" } };

                const from = (page - 1) * pageSize;
                const to = from + pageSize - 1;

                let query = supabase
                    .from("workspace_learning_sessions")
                    .select(`
                        *
                        , user:user_id!inner(id, name)
                        , workspace:workspace_id!inner(title, scope, workspace_members!inner(user_id))
                        , status
                    `, { count: "exact" })
                    .eq('user_id', user.id);

                if (workspace_id) {
                    query = query.eq("workspace_id", workspace_id);
                }

                let { data, error, count } = await query
                    .order("created_at", { ascending: false })
                    .range(from, to);

                if (error) {
                    // PGRST103 / HTTP 416 berarti range halaman habis (sudah halaman terakhir)
                    // Kembalikan array kosong agar cache RTK Query tetap berstatus 'fulfilled'
                    if (error.code === 'PGRST103' || error.message.includes("range")) {
                        return { data: { results: [], count: count ?? 0 } };
                    }
                    return { error: { message: error.message } };
                }

                return { data: { results: data ?? [], count: count ?? 0 } };
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
                    currentCache.results = newItems.results;
                    currentCache.count = newItems.count;
                } else {
                    // Jika halaman 2 dan seterusnya, APPEND data ke array 'results'
                    currentCache.results.push(...newItems.results);
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
                        ...result.results.map(({ id }) => ({ type: 'LearningSession' as const, id })),
                        { type: 'LearningSession' as const, id: 'LIST' },
                    ]
                    : [
                        { type: 'LearningSession' as const, id: 'LIST' }
                    ],
        }),
    }),
});

export const {
    useCreateSessionMutation,
    useGetLearningSessionsByWorkspaceIdQuery,
    useLazyGetLearningSessionsByWorkspaceIdQuery,
    useGetLearningSessionByIdQuery,
    useLazyGetLearningSessionByIdQuery,
} = learningSessionAPI;