import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import { authClient } from '../utils/authClient';

export type MemberTypes = {
    readonly id: string;
    organizationId: string;
    userId: string;
    user?: any;
    role: 'owner' | 'member';
}

export const memberAPI = createApi({
    reducerPath: 'memberAPI',
    baseQuery: fakeBaseQuery<{ message: string }>(),
    tagTypes: ['Member'],
    endpoints: (builder) => ({
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
        })
    })
});

export const {
    useGetMembersByOrganizationIdQuery,
} = memberAPI;