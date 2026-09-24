import CanvasEditorPage from "../pages/dashboard/editor/canvas/Page";
import RichTextEditorPage from "../pages/dashboard/editor/richtext/Page";
import HomePage from "../pages/dashboard/home/Home";
import WorkspaceEditorPage from "../pages/dashboard/editor/workspace/Page";
import WorkspaceDetailPage from "../pages/dashboard/workspace/detail/Page";
import { RouteProps } from "react-router";
import WorkspaceMembersPage from "../pages/dashboard/workspace/members/Page";
import WorkspacePage from "../pages/dashboard/workspace/Page";
import FilesEditorPage from "../pages/dashboard/editor/files/Page";
import NotesPage from "../pages/dashboard/notes/Page";
import MaterialsPage from "../pages/dashboard/materials/Page";
import DigestsPage from "../pages/dashboard/digests/Page";
import AccountDeletionPage from "../pages/dashboard/account-deletion/Page";
import ChatbotPage from "../pages/dashboard/chatbot/Page";
import SessionEditorPage from "../pages/dashboard/editor/session/Page";
import SessionsPage from "../pages/dashboard/workspace/sessions/Page";
import SessionDetailPage from "../pages/dashboard/workspace/sessions/detail/Page";

export const dashboardRoutes: RouteProps[] = [
    { path: "/dashboard", element: <HomePage /> },
    { path: "/dashboard/editor/canvas", element: <CanvasEditorPage /> },
    { path: "/dashboard/editor/richtext", element: <RichTextEditorPage /> },
    { path: "/dashboard/editor/files", element: <FilesEditorPage /> },
    { path: "/dashboard/editor/workspace", element: <WorkspaceEditorPage /> },
    { path: "/dashboard/editor/workspace/:id", element: <WorkspaceEditorPage /> },
    { path: "/dashboard/workspace", element: <WorkspacePage /> },
    { path: "/dashboard/workspace/:id", element: <WorkspaceDetailPage /> },
    { path: "/dashboard/workspace/:id/sessions", element: <SessionsPage /> },
    { path: "/dashboard/workspace/:id/sessions/:sessionId", element: <SessionDetailPage /> },
    { path: "/dashboard/workspace/:id/members", element: <WorkspaceMembersPage /> },
    { path: "/dashboard/notes", element: <NotesPage /> },
    { path: "/dashboard/materials", element: <MaterialsPage /> },
    { path: "/dashboard/digests", element: <DigestsPage /> },
    { path: "/dashboard/account-deletion", element: <AccountDeletionPage /> },
    { path: "/dashboard/chatbot", element: <ChatbotPage /> },
    { path: "/dashboard/editor/session", element: <SessionEditorPage /> },
];