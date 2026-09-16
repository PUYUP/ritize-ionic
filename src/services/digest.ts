import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import { getUser } from '../utils/authState';
import { supabase } from '../lib/supabase';

export type DigestTypes = {
    readonly id: string;
    readonly workspace_id: string;

    content: string;
    for_date: string;
    category: string;
    attributes: any;
}

export const digestAPI = createApi({
    reducerPath: 'digestAPI',
    baseQuery: fakeBaseQuery<{ message: string }>(),
    tagTypes: ['Digest'],
    endpoints: (builder) => ({
        // get workspace by id with full data
        getDigestById: builder.query<DigestTypes, string>({
            queryFn: async (id) => {
                const { data, error } = await supabase
                    .from("digests")
                    .select(`
                        *,
                        workspace:workspace_id!inner(
                            title
                            , workspace_members!inner(user_id)
                        )
                    `)
                    .eq("id", id)
                    .single();

                if (error) {
                    return { error: { message: error.message ?? 'Failed to fetch workspace' } };
                }

                return { data: { ...data, member_count: data.member_count?.[0]?.count || 0 } };
            },
            providesTags: (result, error, id) => [{ type: 'Digest', id }],
        }),

        // get digests
        getDigests: builder.query<{ results: any[], count: number }, { workspace_id?: string; page?: number, pageSize?: number }>({
            queryFn: async ({ workspace_id, page = 1, pageSize = 20 }) => {
                const user = await getUser();
                if (!user?.id) return { error: { message: "[Get Digests] User not found" } };

                const from = (page - 1) * pageSize;
                const to = from + pageSize - 1;

                let query = supabase
                    .from('digests')
                    .select(`
                        *
                        , workspace:workspace_id!inner(
                            title
                            , workspace_members!inner(user_id)
                        )
                    `, { count: "exact" })
                    .order('for_date', { ascending: false });

                if (workspace_id) {
                    query = query.eq("workspace_id", workspace_id);
                } else {
                    // Dapatkan semua notes di mana current user adalah member dari workspace notes tersebut
                    query = query.eq("workspace.workspace_members.user_id", user.id);
                }

                const { data, error, count } = await query
                    .range(from, to);

                if (error) {
                    // PGRST103 / HTTP 416 berarti range halaman habis (sudah halaman terakhir)
                    // Kembalikan array kosong agar cache RTK Query tetap berstatus 'fulfilled'
                    if (error.code === 'PGRST103' || error.message.includes("range")) {
                        return { data: { results: [], count: count ?? 0 } };
                    }
                    return { error: { message: error.message } };
                }

                return { data: { results: data as any[], count: count ?? 0 } };
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

            providesTags: (result, error, { workspace_id }) => [
                { type: 'Digest', id: workspace_id },
                { type: 'Digest', id: 'LIST' },
            ],
        }),
    }),
});

export const {
    useGetDigestsQuery,
    useLazyGetDigestsQuery,
} = digestAPI