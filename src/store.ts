import { configureStore } from '@reduxjs/toolkit'
import { organizationAPI } from './services/organization'

export const store = configureStore({
    reducer: {
        [organizationAPI.reducerPath]: organizationAPI.reducer,
    },
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().concat(organizationAPI.middleware),
})

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>
// Inferred type: {posts: PostsState, comments: CommentsState, users: UsersState}
export type AppDispatch = typeof store.dispatch