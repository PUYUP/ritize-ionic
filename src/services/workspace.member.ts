import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import { workspaceAPI } from './workspace';
import { supabase } from '../lib/supabase';

export type MemberTypes = {
    readonly id: string;
    readonly user: any;
    workspace_id: string;
    user_id: string;
    role: 'admin' | 'member' | 'owner';
}

export const workspaceMemberAPI = createApi({
    reducerPath: 'workspaceMemberAPI',
    baseQuery: fakeBaseQuery<{ message: string }>(),
    tagTypes: ['WorkspaceMember', 'Workspace'],
    endpoints: (builder) => ({
        // ...
        // Get workspace members
        // ...
        getMembersByWorkspaceId: builder.query<{
            results: MemberTypes[]
        }, string>({
            queryFn: async (workspace_id: string) => {
                const { data, error } = await supabase
                    .from("workspace_members")
                    .select("*, user(*)")
                    .eq("workspace_id", workspace_id)
                    .order("created_at", { ascending: false });

                if (error) {
                    return { error: { message: error.message ?? 'Failed to fetch members' } };
                }

                return { data: { results: data } };
            },
            providesTags: (result, error, id) => [{ type: 'WorkspaceMember', id }],
        }),

        // ...
        // Add member to workspace
        // ...
        addMembersToWorkspace: builder.mutation<
            MemberTypes[],
            {
                workspace_id: string;
                members: { user_id: string; role: MemberTypes['role']; workspace_id: string }[]
            }
        >({
            queryFn: async ({ workspace_id, members }) => {
                const { data, error } = await supabase
                    .from("workspace_members")
                    .upsert([...members])
                    .select('*');

                if (error) {
                    return { error: error };
                }

                return { data: data };
            },
            async onQueryStarted({ workspace_id }, { dispatch, queryFulfilled }) {
                try {
                    await queryFulfilled; // tunggu delete-nya sukses dulu
                    dispatch(
                        workspaceAPI.util.invalidateTags([
                            { type: 'Workspace', id: workspace_id }, // refresh detail workspace
                            { type: 'Workspace', id: 'LIST' },       // refresh memberCount di list
                        ])
                    );
                } catch {
                    // mutation gagal, tidak perlu invalidate apa pun
                }
            },
            invalidatesTags: (result, error, { workspace_id, members }) => [
                { type: 'WorkspaceMember', id: workspace_id },
            ],
        }),

        // ...
        // Remove member
        // ...
        removeMember: builder.mutation<
            void,
            {
                workspace_id: string;
                member_id: string;
            }
        >({
            queryFn: async ({ workspace_id, member_id }) => {
                const { data, error } = await supabase
                    .from("workspace_members")
                    .delete()
                    .eq("id", member_id)
                    .eq("workspace_id", workspace_id);

                if (error) {
                    return { error: { message: error.message ?? 'Failed to remove member' } };
                }

                return { data: undefined };
            },
            async onQueryStarted({ workspace_id }, { dispatch, queryFulfilled }) {
                try {
                    await queryFulfilled; // tunggu delete-nya sukses dulu
                    dispatch(
                        workspaceAPI.util.invalidateTags([
                            { type: 'Workspace', id: workspace_id }, // refresh detail workspace
                            { type: 'Workspace', id: 'LIST' },       // refresh memberCount di list
                        ])
                    );
                } catch {
                    // mutation gagal, tidak perlu invalidate apa pun
                }
            },
            invalidatesTags: (result, error, { workspace_id }) => [
                { type: 'WorkspaceMember', id: workspace_id },
            ],
        }),

        // ...
        // Update member role
        // ...
        updateRole: builder.mutation<MemberTypes, { member_id: string, workspace_id: string, role: MemberTypes['role'] }>({
            queryFn: async ({ member_id, workspace_id, role }) => {
                const { data, error } = await supabase
                    .from("workspace_members")
                    .update({ role: role })
                    .eq("id", member_id)
                    .eq("workspace_id", workspace_id)
                    .select()
                    .single();

                if (error) {
                    return { error: { message: error.message ?? 'Failed to update member' } };
                }

                return { data: data };
            },
            invalidatesTags: (result, error, { member_id, workspace_id }) => [
                { type: 'WorkspaceMember', id: workspace_id },
            ],
        }),

        // ...
        // Get single member
        // ...
        getMemberFromWorkspace: builder.query<MemberTypes, { workspace_id: string, user_id: string }>({
            queryFn: async ({ workspace_id, user_id }) => {
                const { data, error } = await supabase
                    .from("workspace_members")
                    .select("*")
                    .eq("workspace_id", workspace_id)
                    .eq("user_id", user_id)
                    .single();

                if (error) {
                    return { error: { message: error.message ?? 'Failed to fetch member' } };
                }

                return { data: data };
            },
            providesTags: (result, error, { workspace_id, user_id }) => [{ type: 'WorkspaceMember', workspace_id }],
        }),

        // ...
        // Get members by user ids
        // ...
        getMembersByWorkspaceIdAndUserIds: builder.query<MemberTypes[], { workspace_id: string, user_ids: string[] }>({
            queryFn: async ({ workspace_id, user_ids }) => {
                const { data, error } = await supabase
                    .from("workspace_members")
                    .select("*")
                    .eq("workspace_id", workspace_id)
                    .in("user_id", user_ids);

                if (error) {
                    return { error: { message: error.message ?? 'Failed to fetch members' } };
                }

                return { data: data };
            },
            providesTags: (result, error, { workspace_id }) => [{ type: 'WorkspaceMember', workspace_id }],
        })
    })
});

export const {
    useGetMembersByWorkspaceIdQuery,
    useAddMembersToWorkspaceMutation,
    useRemoveMemberMutation,
    useUpdateRoleMutation,
    useGetMemberFromWorkspaceQuery,
    useLazyGetMemberFromWorkspaceQuery,
    useGetMembersByWorkspaceIdAndUserIdsQuery,
    useLazyGetMembersByWorkspaceIdAndUserIdsQuery,
} = workspaceMemberAPI;