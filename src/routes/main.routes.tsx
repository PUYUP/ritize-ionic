import { RouteProps } from "react-router";
import Page from "../pages/Page";
import OAuthGooglePage from "../pages/auth/oauth-google/Page";
import RegisterPage from "../pages/auth/register/Page";
import LoginPage from "../pages/auth/login/Page";
import BoadingPage from "../pages/BoadingPage";
import ChatbotPage from "../pages/dashboard/chatbot/Page";

export const mainRoutes: RouteProps[] = [
    { path: "/", element: <BoadingPage /> },
    { path: "/oauth-google", element: <OAuthGooglePage /> },
    { path: "/login", element: <LoginPage /> },
    { path: "/register", element: <RegisterPage /> },
    { path: "/chatbot/u/:userId/c/:conversationId", element: <ChatbotPage /> },
];