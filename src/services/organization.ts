import { createApi, fakeBaseQuery, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import { authClient } from '../utils/authClient';

export type OrganizationTypes = {
    readonly id: string;
    name: string;
    slug: string;
    metadata: {
        scope: 'personal' | 'group';
    };
    members?: MemberTypes[];
}

export type MemberTypes = {
    readonly id: string;
    role: string;
    userId: string;
    organizationId: string;
}

export const organizationAPI = createApi({
    reducerPath: 'organizationAPI',
    baseQuery: fakeBaseQuery<{ message: string }>(),
    tagTypes: ['Organization'],
    endpoints: (builder) => ({
        // get organization by id with full data
        getOrganizationById: builder.query<OrganizationTypes, string>({
            queryFn: async (id) => {
                const { data, error } = await authClient.organization.getFullOrganization({
                    query: { organizationId: id },
                });

                if (error) {
                    return { error: { message: error.message ?? 'Failed to fetch organization' } };
                }

                const metadata = typeof data.metadata === 'string' ? JSON.parse(data.metadata) : (data.metadata || {});
                const serialized = JSON.parse(JSON.stringify({ ...data, metadata }));

                return { data: serialized as OrganizationTypes };
            },
            providesTags: (result, error, id) => [{ type: 'Organization', id }],
        }),

        // update organization
        updateOrganization: builder.mutation<OrganizationTypes, { id: string, data: OrganizationTypes }>({
            queryFn: async ({ id, data }) => {
                const { data: updatedData, error } = await authClient.organization.update({
                    organizationId: id,
                    data: {
                        name: data.name,
                        metadata: data.metadata,
                    },
                });

                if (error) {
                    return { error: { message: error.message ?? 'Failed to update organization' } };
                }

                const metadata = typeof updatedData.metadata === 'string' ? JSON.parse(updatedData.metadata) : (updatedData.metadata || {});
                const serialized = JSON.parse(JSON.stringify({ ...updatedData, metadata }));

                return { data: serialized as OrganizationTypes };
            },
            invalidatesTags: [{ type: 'Organization', id: 'LIST' }],
        }),
    }),
})

export const { useGetOrganizationByIdQuery, useUpdateOrganizationMutation } = organizationAPI