import { configureStore } from '@reduxjs/toolkit'
import { userAPI } from './services/user'
import { workspaceAPI } from './services/workspace'
import { workspaceMemberAPI } from './services/workspace.member'
import { notesAPI } from './services/notes'
import { digestAPI } from './services/digest'
import { digestVisibleThinkingAPI } from './services/digest.visible.thinking'
import { learningSessionAPI } from './services/learning.session'

export const store = configureStore({
    reducer: {
        [userAPI.reducerPath]: userAPI.reducer,
        [workspaceAPI.reducerPath]: workspaceAPI.reducer,
        [workspaceMemberAPI.reducerPath]: workspaceMemberAPI.reducer,
        [notesAPI.reducerPath]: notesAPI.reducer,
        [digestAPI.reducerPath]: digestAPI.reducer,
        [digestVisibleThinkingAPI.reducerPath]: digestVisibleThinkingAPI.reducer,
        [learningSessionAPI.reducerPath]: learningSessionAPI.reducer,
    },
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().concat(
            userAPI.middleware,
            workspaceAPI.middleware,
            workspaceMemberAPI.middleware,
            notesAPI.middleware,
            digestAPI.middleware,
            digestVisibleThinkingAPI.middleware,
            learningSessionAPI.middleware,
        ),
})

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>
// Inferred type: {posts: PostsState, comments: CommentsState, users: UsersState}
export type AppDispatch = typeof store.dispatch