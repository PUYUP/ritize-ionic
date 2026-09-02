import CanvasEditorPage from "../pages/dashboard/editor/canvas/Page";
import RichTextEditorPage from "../pages/dashboard/editor/richtext/Page";
import HomePage from "../pages/dashboard/home/Home";
import VoiceRecorderPage from "../pages/dashboard/editor/voice/Page";
import WorkspaceEditorPage from "../pages/dashboard/editor/workspace/Page";
import WorkspaceDetailPage from "../pages/dashboard/workspace/detail/Page";
import UploadImagePage from "../pages/dashboard/editor/upload-image/Page";
import { RouteProps } from "react-router";
import WorkspaceMembersPage from "../pages/dashboard/workspace/members/Page";
import WorkspacePage from "../pages/dashboard/workspace/Page";

export const dashboardRoutes: RouteProps[] = [
    { path: "/dashboard", element: <HomePage /> },
    { path: "/dashboard/editor/canvas", element: <CanvasEditorPage /> },
    { path: "/dashboard/editor/richtext", element: <RichTextEditorPage /> },
    { path: "/dashboard/editor/voice", element: <VoiceRecorderPage /> },
    { path: "/dashboard/editor/upload-image", element: <UploadImagePage /> },
    { path: "/dashboard/editor/workspace", element: <WorkspaceEditorPage /> },
    { path: "/dashboard/editor/workspace/:id", element: <WorkspaceEditorPage /> },
    { path: "/dashboard/workspace", element: <WorkspacePage /> },
    { path: "/dashboard/workspace/:id", element: <WorkspaceDetailPage /> },
    { path: "/dashboard/workspace/:id/members", element: <WorkspaceMembersPage /> },
];