import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import type { Action, ThunkAction } from '@reduxjs/toolkit';
import { supabase } from '../lib/supabase';

type GetUserArgs =
    | { id: string; email?: string }
    | { id?: string; email: string };

type GetUsersArgs =
    | { ids: string[]; emails?: string[] }
    | { ids?: string[]; emails: string[] };

type User = {
    id: string;
    email: string;
    name: string;
    token_balance: number;
};

export const userAPI = createApi({
    reducerPath: 'userAPI',
    baseQuery: fakeBaseQuery<{ message: string }>(),
    tagTypes: ['User'],
    endpoints: (builder) => ({
        getUser: builder.query<User, GetUserArgs>({
            queryFn: async ({ id, email }) => {
                if (!id && !email) {
                    return { error: { message: 'id or email must be provided' } };
                }

                let query = supabase.from('user').select('id, email, name, token_balance');

                if (id && email) {
                    query = query.or(`id.eq.${id},email.eq.${email}`);
                } else if (id) {
                    query = query.eq('id', id);
                } else if (email) {
                    query = query.eq('email', email);
                }

                const { data, error } = await query.maybeSingle();

                if (error) return { error: { message: error.message } };
                if (!data) return { error: { message: 'User not found' } };

                return { data };
            },
            providesTags: (result) =>
                result ? [{ type: 'User', id: result.id }] : [],
        }),

        getCurrentUser: builder.query<User, void>({
            queryFn: async () => {
                const { data, error } = await supabase.auth.getUser();
                if (error) return { error: { message: error.message } };
                if (!data.user) return { error: { message: 'User not found' } };

                const { data: userData } = await supabase
                    .from('user')
                    .select('id, email, name, token_balance')
                    .eq('auth_user_id', data.user.id)
                    .maybeSingle();

                if (!userData) return { error: { message: 'User not found' } };

                return {
                    data: {
                        id: userData.id,
                        email: userData.email,
                        name: userData.name,
                        token_balance: userData.token_balance
                    }

                };
            },
            providesTags: (result) =>
                result ? [{ type: 'User', id: result.id }] : [],
        }),

        getUsers: builder.query<User[], GetUsersArgs>({
            queryFn: async ({ ids, emails }) => {
                if ((!ids || ids.length === 0) && (!emails || emails.length === 0)) {
                    return { error: { message: 'ids or emails must be provided' } };
                }

                // quote each value to safely handle special chars (e.g. "@", "," in emails)
                const idList = ids?.map((v) => `"${v}"`).join(',');
                const emailList = emails?.map((v) => `"${v}"`).join(',');

                let query = supabase.from('user').select('id, email, name, token_balance');

                if (ids?.length && emails?.length) {
                    query = query.or(`id.in.(${idList}),email.in.(${emailList})`);
                } else if (ids?.length) {
                    query = query.in('id', ids);
                } else if (emails?.length) {
                    query = query.in('email', emails);
                }

                const { data, error } = await query;

                if (error) return { error: { message: error.message } };

                return { data: data ?? [] };
            },
            providesTags: (result) =>
                result
                    ? [
                        ...result.map(({ id }) => ({ type: 'User' as const, id })),
                        { type: 'User' as const, id: 'LIST' },
                    ]
                    : [{ type: 'User' as const, id: 'LIST' }],
        }),
    }),
});

export const {
    useGetUserQuery,
    useLazyGetUserQuery,
    useGetUsersQuery,
    useLazyGetUsersQuery,
    useGetCurrentUserQuery,
} = userAPI;

/**
 * Update user data yang sudah ada di cache RTK Query secara lokal saja,
 * TANPA melakukan request apa pun ke Supabase/DB.
 *
 * Berguna untuk optimistic update, misalnya setelah token_balance berubah
 * akibat aksi di client (mis. user memakai token), tanpa perlu refetch.
 *
 * Fungsi ini akan mem-patch semua cache entry yang cocok dengan `id` di:
 * - getCurrentUser (single entry)
 * - getUser (bisa ada banyak cache entry dengan args berbeda: by id, by email, dst)
 * - getUsers (list queries; user yang cocok di dalam array akan ikut di-update)
 *
 * Cara pakai:
 *   dispatch(updateUserState({ id: user.id, token_balance: 100 }));
 */
export const updateUserState =
    (patch: Partial<Omit<User, 'id'>> & { id: string }): ThunkAction<void, any, unknown, Action> =>
        (dispatch, getState) => {
            const { id, ...changes } = patch;
            const state = getState();

            // getCurrentUser -> selalu di-cache dengan arg `undefined`
            dispatch(
                userAPI.util.updateQueryData('getCurrentUser', undefined, (draft) => {
                    if (draft.id === id) Object.assign(draft, changes);
                })
            );

            // getUser -> bisa punya beberapa cache entry (by id, by email, dst),
            // jadi kita loop semua args yang sedang ter-cache
            userAPI.util.selectCachedArgsForQuery(state, 'getUser').forEach((args) => {
                dispatch(
                    userAPI.util.updateQueryData('getUser', args, (draft) => {
                        if (draft.id === id) Object.assign(draft, changes);
                    })
                );
            });

            // getUsers -> cari user dengan id yang cocok di setiap list yang ter-cache
            userAPI.util.selectCachedArgsForQuery(state, 'getUsers').forEach((args) => {
                dispatch(
                    userAPI.util.updateQueryData('getUsers', args, (draft) => {
                        const user = draft.find((u) => u.id === id);
                        if (user) Object.assign(user, changes);
                    })
                );
            });
        };