import { createAuthClient } from "better-auth/client";
export const authClient = createAuthClient({
    baseURL: "https://auth.atlanize.com" // The base URL of your auth server
})