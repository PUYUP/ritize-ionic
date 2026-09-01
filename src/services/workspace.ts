import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import { authClient } from '../utils/authClient';
import { getUser } from '../utils/authState';
import { supabase } from '../utils/supabaseClient';
import slugify from 'slugify';

export type WorkspaceTypes = {
    readonly id: string;
    readonly user_id: string;
    readonly next_notes_processing_at: string;

    title: string;
    description?: string | null;
    language_code: string;
    scope: 'personal' | 'group';

    // placeholder only, may join from another table
    memberCount?: number;
    todayNoteCount?: number;
}

export type MemberTypes = {
    readonly id: string;
    workspace_id: string;
    user_id: string;
    role: "owner" | "admin" | "member";
}

export const workspaceAPI = createApi({
    reducerPath: 'workspaceAPI',
    baseQuery: fakeBaseQuery<{ message: string }>(),
    tagTypes: ['Workspace'],
    endpoints: (builder) => ({
        // get workspace by id with full data
        getWorkspaceById: builder.query<WorkspaceTypes, string>({
            queryFn: async (id) => {
                const { data, error } = await supabase
                    .from("workspaces")
                    .select(`
                        *,
                        memberCount:workspace_members(count)
                    `)
                    .eq("id", id)
                    .single();

                if (error) {
                    return { error: { message: error.message ?? 'Failed to fetch workspace' } };
                }

                const serialized = JSON.parse(JSON.stringify({
                    ...data,
                    memberCount: data.memberCount?.[0]?.count || 0,
                }));

                return { data: serialized as WorkspaceTypes };
            },
            providesTags: (result, error, id) => [{ type: 'Workspace', id }],
        }),

        // create workspace
        createWorkspace: builder.mutation<WorkspaceTypes, Partial<WorkspaceTypes>>({
            queryFn: async (data) => {
                const user = await getUser();
                const { data: insertedData, error } = await supabase
                    .from("workspaces")
                    .insert({
                        title: data.title,
                        description: data.description,
                        language_code: data.language_code,
                        scope: data.scope,
                        user_id: user.id, // who created
                    })
                    .select(`
                        *,
                        memberCount:workspace_members(count)
                    `)
                    .single();

                if (error) {
                    return { error: { message: error.message ?? 'Failed to create workspace' } };
                }

                // create first member as owner
                const { data: memberData, error: memberError } = await supabase
                    .from("workspace_members")
                    .insert({
                        workspace_id: insertedData.id,
                        user_id: user.id,
                        role: "owner",
                    })
                    .single();

                if (memberError) {
                    return { error: { message: memberError.message ?? 'Failed to create workspace member' } };
                }

                const serialized = JSON.parse(JSON.stringify({ ...insertedData, memberCount: insertedData.memberCount?.[0]?.count || 0 }));
                return { data: serialized as WorkspaceTypes };
            },
            invalidatesTags: (result, error) => [{ type: 'Workspace', id: 'LIST' }],
        }),

        // update workspace
        updateWorkspace: builder.mutation<WorkspaceTypes, { id: string, data: Partial<WorkspaceTypes> }>({
            queryFn: async ({ id, data }) => {
                const { data: updatedData, error } = await supabase
                    .from("workspaces")
                    .update({
                        title: data.title,
                        description: data.description,
                        language_code: data.language_code,
                        scope: data.scope,
                    })
                    .eq("id", id)
                    .select(`
                        *,
                        memberCount:workspace_members(count)
                    `)
                    .single();

                if (error) {
                    return { error: { message: error.message ?? 'Failed to update workspace' } };
                }

                const metadata = typeof updatedData.metadata === 'string' ? JSON.parse(updatedData.metadata) : (updatedData.metadata || {});
                const serialized = JSON.parse(JSON.stringify({ ...updatedData, metadata }));

                return { data: serialized as WorkspaceTypes };
            },
            invalidatesTags: (result, error, { id }) => [
                { type: 'Workspace', id },
                { type: 'Workspace', id: 'LIST' },
            ],
        }),

        // delete workspace
        deleteWorkspace: builder.mutation<void, { id: string }>({
            queryFn: async ({ id }) => {
                const { error } = await supabase
                    .from('workspaces')
                    .delete()
                    .eq('id', id);

                if (error) {
                    return { error: { message: error.message ?? 'Failed to delete workspace' } };
                }

                return { data: undefined };
            },
            invalidatesTags: (result, error, { id }) => [
                { type: 'Workspace', id: 'LIST' },
            ],
        }),

        // get all workspaces
        getAllWorkspaces: builder.query<WorkspaceTypes[], void>({
            queryFn: async () => {
                const user = await getUser();
                const { data, error } = await supabase
                    .from('workspaces')
                    .select(`
                        *,
                        membersInside:workspace_members!inner(*),
                        memberCount:workspace_members(count)
                    `)
                    .in('membersInside.user_id', [user.id])
                    .order('created_at', { ascending: false })
                    .limit(10);

                if (error) return { error: { message: error.message ?? 'Failed to fetch workspaces' } };

                const serialized = data.map((org) => {
                    return JSON.parse(JSON.stringify({
                        ...org,
                        memberCount: org.memberCount?.[0]?.count || 0,
                    }));
                });

                return { data: serialized as WorkspaceTypes[] };
            },
            providesTags: [{ type: 'Workspace', id: 'LIST' }],
        }),
    }),
});

export const {
    useGetWorkspaceByIdQuery,
    useUpdateWorkspaceMutation,
    useCreateWorkspaceMutation,
    useDeleteWorkspaceMutation,
    useGetAllWorkspacesQuery,
} = workspaceAPI