import { RouteProps } from "react-router-dom";
import Page from "../pages/Page";
import OAuthGooglePage from "../pages/auth/oauth-google/Page";

export const mainRoutes: RouteProps[] = [
    { path: "/", element: <Page /> },
    { path: "/oauth-google", element: <OAuthGooglePage /> },
];