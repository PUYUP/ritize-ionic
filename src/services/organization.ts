import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import { authClient } from '../utils/authClient';
import { getUser } from '../utils/authState';
import { supabase } from '../utils/supabaseClient';
import slugify from 'slugify';

export type OrganizationTypes = {
    readonly id: string;
    readonly slug: string;
    name: string;
    metadata: { scope: 'personal' | 'group' };
    members?: MemberTypes[];
    memberCount?: number;
    todayNoteCount?: number;
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

        // create organization
        createOrganization: builder.mutation<OrganizationTypes, { name: string, metadata: { scope: 'personal' | 'group' } }>({
            queryFn: async ({ name, metadata }) => {
                const { data, error } = await authClient.organization.create({
                    name,
                    slug: slugify(name, { lower: true }) as string,
                    metadata,
                });

                if (error) {
                    return { error: { message: error.message ?? 'Failed to create organization' } };
                }

                const serialized = JSON.parse(JSON.stringify({ ...data, metadata }));

                return { data: serialized as OrganizationTypes };
            },
            invalidatesTags: (result, error) => [{ type: 'Organization', id: 'LIST' }],
        }),

        // update organization
        updateOrganization: builder.mutation<OrganizationTypes, { id: string, data: Partial<OrganizationTypes> }>({
            queryFn: async ({ id, data }) => {
                const { data: updatedData, error } = await authClient.organization.update({
                    organizationId: id,
                    data: {
                        name: data.name,
                        slug: data.name ? slugify(data.name, { lower: true }) : undefined,
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
            invalidatesTags: (result, error, { id }) => [
                { type: 'Organization', id },
                { type: 'Organization', id: 'LIST' },
            ],
        }),

        // delete organization
        deleteOrganization: builder.mutation<void, { id: string }>({
            queryFn: async ({ id }) => {
                const { error } = await authClient.organization.delete({
                    organizationId: id,
                });

                if (error) {
                    return { error: { message: error.message ?? 'Failed to delete organization' } };
                }

                return { data: undefined };
            },
            invalidatesTags: (result, error, { id }) => [
                { type: 'Organization', id: 'LIST' },
            ],
        }),

        // get all organizations
        getAllOrganizations: builder.query<OrganizationTypes[], void>({
            queryFn: async () => {
                const user = await getUser();
                const { data, error } = await supabase
                    .from('ba_organizations')
                    .select(`
                        *,
                        membersInside:ba_organization_members!inner(*),
                        memberCount:ba_organization_members(count)
                    `)
                    .eq('membersInside.userId', user.id)
                    .order('createdAt', { ascending: false })
                    .limit(10);

                if (error) return { error: { message: error.message ?? 'Failed to fetch organizations' } };

                const serialized = data.map((org) => {
                    const metadata = typeof org.metadata === 'string' ? JSON.parse(org.metadata) : (org.metadata || {});
                    return JSON.parse(JSON.stringify({
                        ...org,
                        metadata,
                        memberCount: org.memberCount?.[0]?.count || 0,
                    }));
                });

                return { data: serialized as OrganizationTypes[] };
            },
            providesTags: [{ type: 'Organization', id: 'LIST' }],
        }),
    }),
});

export const {
    useGetOrganizationByIdQuery,
    useUpdateOrganizationMutation,
    useCreateOrganizationMutation,
    useDeleteOrganizationMutation,
    useGetAllOrganizationsQuery,
} = organizationAPI