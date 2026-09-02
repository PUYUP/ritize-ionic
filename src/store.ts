import { configureStore } from '@reduxjs/toolkit'
import { userAPI } from './services/user'
import { workspaceAPI } from './services/workspace'
import { workspaceMemberAPI } from './services/workspace.member'

export const store = configureStore({
    reducer: {
        [userAPI.reducerPath]: userAPI.reducer,
        [workspaceAPI.reducerPath]: workspaceAPI.reducer,
        [workspaceMemberAPI.reducerPath]: workspaceMemberAPI.reducer,
    },
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().concat(
            userAPI.middleware,
            workspaceAPI.middleware,
            workspaceMemberAPI.middleware,
        ),
})

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>
// Inferred type: {posts: PostsState, comments: CommentsState, users: UsersState}
export type AppDispatch = typeof store.dispatch