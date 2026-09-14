import { RouteProps } from "react-router";
import Page from "../pages/Page";
import OAuthGooglePage from "../pages/auth/oauth-google/Page";
import RegisterPage from "../pages/auth/register/Page";

export const mainRoutes: RouteProps[] = [
    { path: "/", element: <Page /> },
    { path: "/oauth-google", element: <OAuthGooglePage /> },
    { path: "/register", element: <RegisterPage /> },
];