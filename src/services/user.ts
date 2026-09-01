import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import { supabase } from '../utils/supabaseClient';

type GetUserArgs =
    | { id: string; email?: string }
    | { id?: string; email: string };

type GetUsersArgs =
    | { ids: string[]; emails?: string[] }
    | { ids?: string[]; emails: string[] };

type User = { id: string; email: string };

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

                let query = supabase.from('ba_users').select('id, email');

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

        getUsers: builder.query<User[], GetUsersArgs>({
            queryFn: async ({ ids, emails }) => {
                if ((!ids || ids.length === 0) && (!emails || emails.length === 0)) {
                    return { error: { message: 'ids or emails must be provided' } };
                }

                // quote each value to safely handle special chars (e.g. "@", "," in emails)
                const idList = ids?.map((v) => `"${v}"`).join(',');
                const emailList = emails?.map((v) => `"${v}"`).join(',');

                let query = supabase.from('ba_users').select('id, email');

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
} = userAPI;