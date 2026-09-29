import { LOG_LEVEL, Purchases } from "@revenuecat/purchases-capacitor";
import { useGetCurrentUserQuery } from "../services/user";
import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";

// revenuecat.ts
let configurePromise: Promise<void> | null = null;

export const ensureRevenueCat = (): Promise<void> => {
    if (!configurePromise) {
        configurePromise = (async () => {
            await Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG });
            await Purchases.configure({ apiKey: 'goog_LxigwsbWEExoyhCOZEAyaIcgjRq' });
        })().catch((err) => {
            configurePromise = null; // reset agar bisa dicoba ulang kalau gagal
            throw err;
        });
    }
    return configurePromise;
};

export const RevenueCatSync: React.FC = () => {
    const { data: user } = useGetCurrentUserQuery();

    useEffect(() => {
        if (!Capacitor.isNativePlatform()) return;

        const sync = async () => {
            try {
                // tunggu sampai configure selesai (dipanggil sekali, hasil di-cache)
                await ensureRevenueCat();

                const { appUserID: currentId } = await Purchases.getAppUserID();

                if (user?.id) {
                    if (currentId !== user.id) {
                        await Purchases.logIn({ appUserID: user.id });
                    }
                } else {
                    const { isAnonymous } = await Purchases.isAnonymous();
                    if (!isAnonymous) {
                        await Purchases.logOut();
                    }
                }
            } catch (err) {
                console.error('RevenueCat sync gagal:', err);
            }
        };

        sync();
    }, [user?.id]);

    return null;
};