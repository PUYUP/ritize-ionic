import { configureStore } from '@reduxjs/toolkit'
import { organizationAPI } from './services/organization'
import { memberAPI } from './services/member'
import { userAPI } from './services/user'

export const store = configureStore({
    reducer: {
        [organizationAPI.reducerPath]: organizationAPI.reducer,
        [memberAPI.reducerPath]: memberAPI.reducer,
        [userAPI.reducerPath]: userAPI.reducer,
    },
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().concat(
            organizationAPI.middleware,
            memberAPI.middleware,
            userAPI.middleware,
        ),
})

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>
// Inferred type: {posts: PostsState, comments: CommentsState, users: UsersState}
export type AppDispatch = typeof store.dispatch