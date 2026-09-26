import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import { getUser } from '../utils/authState';
import { supabase } from '../lib/supabase';

export type ChatTypes = {
    readonly id: string;
    readonly conversation_id: string;
    readonly created_at: string;

    title: string;
    messages: any;
}

export const chatAPI = createApi({
    reducerPath: 'chatAPI',
    baseQuery: fakeBaseQuery<{ message: string }>(),
    tagTypes: ['Chat'],
    endpoints: (builder) => ({
        // ...
        // get conversations
        // ...
        getConversations: builder.query<any, void>({
            queryFn: async () => {
                const user = await getUser();
                if (!user) return { error: { message: 'Unauthorized' } };

                const { data, error } = await supabase
                    .from('chats')
                    .select('*')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false });

                if (error) return { error };
                return { data };
            },
            providesTags: ['Chat'],
        }),

        // ...
        // get conversation by id
        // ...
        getConversationById: builder.query<any, string>({
            queryFn: async (conversationId) => {
                const user = await getUser();
                if (!user) return { error: { message: 'Unauthorized' } };

                const { data, error } = await supabase
                    .from('chats')
                    .select('*')
                    .eq('user_id', user.id)
                    .eq('conversation_id', conversationId)
                    .maybeSingle();

                if (error) return { error };
                if (!data) return { error: { message: 'Conversation not found' } };

                return { data };
            },
            providesTags: (result, error, conversationId) => [
                { type: 'Chat', id: conversationId },
            ],
        }),
    }),
});

export const {
    useGetConversationsQuery,
    useLazyGetConversationsQuery,
    useGetConversationByIdQuery,
    useLazyGetConversationByIdQuery,
} = chatAPI;

// ...
// insert fake item ke cache getConversations tanpa kirim request ke server
// ...
export const addFakeConversation = (
    conversationId: string,
    createdAt: string = new Date().toISOString(),
    title: string = '',
) =>
    chatAPI.util.updateQueryData('getConversations', undefined, (draft) => {
        // Pastikan draft tidak undefined sebelum melakukan unshift
        if (draft) {
            (draft as ChatTypes[]).unshift({
                id: conversationId,
                conversation_id: conversationId,
                created_at: createdAt,
                title: title,
                messages: [],
            });
        }
    });