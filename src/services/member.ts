import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import { authClient } from '../utils/authClient';
import { getCurrentToken } from '../utils/authState';

const API_BASE_URL = 'https://auth.atlanize.com/api';

export type MemberTypes = {
    readonly id: string;
    organizationId: string;
    userId: string;
    user?: any;
    role: 'admin' | 'member' | 'owner';
}

export const memberAPI = createApi({
    reducerPath: 'memberAPI',
    baseQuery: fakeBaseQuery<{ message: string }>(),
    tagTypes: ['Member', 'Organization'],
    endpoints: (builder) => ({
        // ...
        // Get organization members
        // ...
        getMembersByOrganizationId: builder.query<{
            members: MemberTypes[],
            total: number
        }, string>({
            queryFn: async (orgId) => {
                const { data, error } = await authClient.organization.listMembers({
                    query: { organizationId: orgId },
                });

                if (error) {
                    return { error: { message: error.message ?? 'Failed to fetch members' } };
                }

                const serialized = JSON.parse(JSON.stringify({ ...data }));

                return { data: serialized };
            },
            providesTags: (result, error, id) => [{ type: 'Member', id }],
        }),

        // ...
        // Add member to organization
        // ...
        addMembersToOrganization: builder.mutation<
            MemberTypes[],
            {
                organizationId: string;
                members: { userId: string; role: MemberTypes['role']; organizationId: string }[];
            }
        >({
            queryFn: async ({ organizationId, members }) => {
                try {
                    const token = await getCurrentToken();
                    const response = await fetch(`${API_BASE_URL}/members`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        credentials: 'include', // kirim cookie session auth kalau auth.atlanize.com beda origin dari app
                        body: JSON.stringify({ organizationId, members }),
                    });

                    const body = await response.json().catch(() => null);

                    if (!response.ok) {
                        return {
                            error: {
                                message: body?.message ?? `Failed to add members (${response.status})`,
                                details: body,
                            },
                        };
                    }

                    return { data: body };
                } catch (err) {
                    return {
                        error: {
                            message: err instanceof Error ? err.message : 'Failed to add members',
                        },
                    };
                }
            },
            invalidatesTags: (result, error, { organizationId }) => [
                { type: 'Member', id: organizationId },
                { type: 'Organization', id: 'LIST' },
                { type: 'Organization', id: organizationId },
            ],
        }),

        // ...
        // Remove member
        // ...
        removeMember: builder.mutation<
            void,
            {
                organizationId: string;
                memberIdOrEmail: string;
            }
        >({
            queryFn: async ({ organizationId, memberIdOrEmail }) => {
                try {
                    const { data, error } = await authClient.organization.removeMember({
                        memberIdOrEmail: memberIdOrEmail,
                        organizationId: organizationId,
                    });

                    if (error) {
                        return {
                            error: {
                                message: error.message ?? `Failed to remove member (${error.status})`,
                                details: error,
                            },
                        };
                    }

                    const serialized = JSON.parse(JSON.stringify({ ...data }));
                    return { data: serialized };
                } catch (err) {
                    return {
                        error: {
                            message: err instanceof Error ? err.message : 'Failed to remove member',
                        },
                    };
                }
            },
            invalidatesTags: (result, error, { organizationId }) => [
                { type: 'Member', id: organizationId },
                { type: 'Organization', id: 'LIST' },
                { type: 'Organization', id: organizationId },
            ],
        }),

        // ...
        // Update member role
        // ...
        updateRole: builder.mutation<void, { memberId: string, organizationId: string, role: MemberTypes['role'] }>({
            queryFn: async ({ memberId, organizationId, role }) => {
                const { data, error } = await authClient.organization.updateMemberRole({
                    memberId: memberId,
                    organizationId: organizationId,
                    role: role,
                });

                if (error) {
                    return { error: { message: error.message ?? 'Failed to update member' } };
                }

                const serialized = JSON.parse(JSON.stringify({ ...data }));

                return { data: serialized };
            },
            invalidatesTags: (result, error, { memberId, organizationId }) => [
                { type: 'Member', id: organizationId },
                { type: 'Organization', id: 'LIST' },
                { type: 'Organization', id: organizationId },
            ],
        }),

        // ...
        // Get single member
        // ...
        getSingleMemberByOrganizationIdAndUserId: builder.query<MemberTypes, { organizationId: string, userId: string }>({
            queryFn: async ({ organizationId, userId }) => {
                try {
                    const { data, error } = await authClient.organization.listMembers({
                        query: {
                            organizationId: organizationId,
                            filterField: "userId",
                            filterOperator: "eq",
                            filterValue: userId,
                            offset: 0,
                            limit: 1,
                        },
                    });

                    if (error) {
                        return {
                            error: {
                                message: error.message ?? `Failed to get single member (${error.status})`,
                                details: error,
                            },
                        };
                    }

                    const serialized = JSON.parse(JSON.stringify({ ...data }));
                    return { data: serialized?.members?.[0] ?? null };
                } catch (err) {
                    return {
                        error: {
                            message: err instanceof Error ? err.message : 'Failed to get single member',
                        },
                    };
                }
            },
            providesTags: (result, error, { organizationId, userId }) => [
                { type: 'Member', id: `${organizationId}-${userId}` },
                { type: 'Organization', id: 'LIST' },
                { type: 'Organization', id: organizationId },
            ],
        })
    })
});

export const {
    useGetMembersByOrganizationIdQuery,
    useAddMembersToOrganizationMutation,
    useRemoveMemberMutation,
    useUpdateRoleMutation,
    useGetSingleMemberByOrganizationIdAndUserIdQuery,
    useLazyGetSingleMemberByOrganizationIdAndUserIdQuery
} = memberAPI;