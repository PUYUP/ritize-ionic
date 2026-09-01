import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import { supabase } from '../utils/supabaseClient';

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
                    .eq("workspace_id", workspace_id);

                if (error) {
                    return { error: { message: error.message ?? 'Failed to fetch members' } };
                }

                const serialized = JSON.parse(JSON.stringify({ results: data }));
                return { data: serialized };
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
                    .insert([...members])
                    .select('*');

                if (error) {
                    return { error: { message: error.message ?? 'Failed to add members' } };
                }

                const serialized = JSON.parse(JSON.stringify({ ...data }));
                return { data: serialized };
            },
            invalidatesTags: (result, error, { workspace_id, members }) => [
                { type: 'WorkspaceMember', id: workspace_id },
                { type: 'Workspace', id: 'LIST' },
                { type: 'Workspace', id: workspace_id },
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
            invalidatesTags: (result, error, { workspace_id }) => [
                { type: 'WorkspaceMember', id: workspace_id },
                { type: 'Workspace', id: 'LIST' },
                { type: 'Workspace', id: workspace_id },
            ],
        }),

        // ...
        // Update member role
        // ...
        updateRole: builder.mutation<void, { member_id: string, workspace_id: string, role: MemberTypes['role'] }>({
            queryFn: async ({ member_id, workspace_id, role }) => {
                const { data, error } = await supabase
                    .from("workspace_members")
                    .update({ role: role })
                    .eq("id", member_id)
                    .eq("workspace_id", workspace_id)
                    .select();

                if (error) {
                    return { error: { message: error.message ?? 'Failed to update member' } };
                }

                const serialized = JSON.parse(JSON.stringify({ ...data }));

                return { data: serialized };
            },
            invalidatesTags: (result, error, { member_id, workspace_id }) => [
                { type: 'WorkspaceMember', id: workspace_id },
                { type: 'Workspace', id: 'LIST' },
                { type: 'Workspace', id: workspace_id },
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

                const serialized = JSON.parse(JSON.stringify({ ...data }));

                return { data: serialized };
            },
            providesTags: (result, error, { workspace_id, user_id }) => [
                { type: 'WorkspaceMember', id: workspace_id },
                { type: 'Workspace', id: 'LIST' },
                { type: 'Workspace', id: workspace_id },
            ],
        })
    })
});

export const {
    useGetMembersByWorkspaceIdQuery,
    useAddMembersToWorkspaceMutation,
    useRemoveMemberMutation,
    useUpdateRoleMutation,
    useGetMemberFromWorkspaceQuery,
    useLazyGetMemberFromWorkspaceQuery
} = workspaceMemberAPI;