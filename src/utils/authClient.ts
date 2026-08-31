import { createAuthClient } from "better-auth/client";
import { organizationClient } from "better-auth/client/plugins";
import { Preferences } from '@capacitor/preferences';
import { getCurrentToken } from "./authState";

let cachedToken: string | null = null;

export const authClient = createAuthClient({
    baseURL: "https://auth.atlanize.com", // The base URL of your auth server
    plugins: [
        organizationClient()
    ],
    fetchOptions: {
        credentials: "include",
        onSuccess: async (ctx) => {
            const token = ctx.response.headers.get("set-auth-token");
            if (token) {
                cachedToken = token;
                await Preferences.set({ key: "bearer_token", value: token });
            }
        },
        auth: {
            type: "Bearer",
            token: async () => {
                if (!cachedToken) {
                    const token = await getCurrentToken();
                    cachedToken = token ?? null;
                }
                console.log("Token", cachedToken);
                return cachedToken ?? "";
            },
        },
    },
})