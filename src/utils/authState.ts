import { Preferences } from "@capacitor/preferences";

export const getCurrentToken = async () => {
    const { value } = await Preferences.get({ key: "bearer_token" });
    return value;
}

export const getUser = async () => {
    const { value } = await Preferences.get({ key: "ritize_user" });
    return value ? JSON.parse(value) : null;
}
