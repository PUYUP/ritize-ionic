import { IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonPage, IonText, IonToolbar, useIonRouter } from '@ionic/react';
import './TokenReward.css';
import { Link, useSearchParams } from 'react-router-dom';
import { diamondSharp, playOutline } from 'ionicons/icons';
import { AdMob, AdmobConsentStatus, BannerAdOptions, BannerAdSize, BannerAdPosition, RewardAdPluginEvents, AdLoadInfo, AdMobRewardItem, AdMobRevenueData } from '@capacitor-community/admob';
import { Capacitor } from '@capacitor/core';
import { useGetCurrentUserQuery, useUpdateUserMutation } from '../../../services/user';
import { useEffect } from 'react';


const TokenRewardPage: React.FC = () => {
    const ionRouter = useIonRouter();
    const { data: userData, isFetching: isUserDataFetching } = useGetCurrentUserQuery();
    const [updateUser] = useUpdateUserMutation();

    useEffect(() => {
        (async () => {
            await AdMob.addListener(RewardAdPluginEvents.Loaded, (info: AdLoadInfo) => {
                console.log('Rewarded ad loaded', info.adUnitId);
            });
            await AdMob.addListener(RewardAdPluginEvents.FailedToLoad, console.error);
            await AdMob.addListener(RewardAdPluginEvents.Rewarded, async (reward: AdMobRewardItem) => {
                console.log('Reward earned', reward.amount, reward.type);

                // update user balance token
                if (userData) {
                    const newBalance = reward.amount + Number(userData.token_balance);
                    await updateUser({
                        id: userData.id,
                        patch: { token_balance: newBalance }
                    });

                    ionRouter.push(`/dashboard/reward-success?balance=${newBalance}&new=${reward.amount}`, 'forward', 'replace');
                }
            });

            await AdMob.addListener(RewardAdPluginEvents.AdImpression, (data: AdMobRevenueData) => {
                console.log(data);
            });
        })()
    }, [userData]);

    const showAd = async () => {
        const bannerAdId =
            Capacitor.getPlatform() === 'ios'
                ? 'ca-app-pub-3940256099942544/2934735716'
                : 'ca-app-pub-3940256099942544/5224354917';

        await AdMob.initialize({
            testingDevices: ['efee4929-4725-463a-b349-d1bb2ec4bffb'],
            initializeForTesting: true,
        });

        let consentInfo = await AdMob.requestConsentInfo();
        if (consentInfo.isConsentFormAvailable && consentInfo.status === AdmobConsentStatus.REQUIRED) {
            consentInfo = await AdMob.showConsentForm();
        }

        if (!consentInfo.canRequestAds) {
            // Consent not ready — no banner is shown.
            return;
        }

        const options: BannerAdOptions = {
            adId: bannerAdId,
            adSize: BannerAdSize.ADAPTIVE_BANNER,
            position: BannerAdPosition.BOTTOM_CENTER,
            margin: 0,
        };

        await AdMob.prepareRewardVideoAd(options);
        const rewardItem = await AdMob.showRewardVideoAd();
        // Grant the reward once, using this result or the Rewarded event — not both.
        console.log(rewardItem);
    };

    return (
        <IonPage>
            <IonHeader className="ion-no-border">
                <IonToolbar color={'light'} className='borderless'>
                    <IonButtons slot="start" className="ion-padding-start">
                        <IonBackButton defaultHref="/dashboard" />
                    </IonButtons>
                </IonToolbar>
            </IonHeader>

            <IonContent color={'light'} className="ion-padding">
                <div className="w-full h-full sm:w-12/12 md:w-8/12 lg:w-7/12 xl:w-5/12 mx-auto">
                    <div className='flex h-full w-full justify-center items-center'>
                        <div className='text-center flex flex-col items-center justify-center'>
                            <div className='flex flex-col justify-center items-center mt-6'>
                                <IonText className='uppercase tracker-wider text-sm text-neutral-600 albert-font !font-normal'>Getting Free Tokens</IonText>
                                <IonText className='oswald-font text-6xl font-bold'>10.000</IonText>
                            </div>

                            <div className='text-center mt-6 pb-20'>
                                {Capacitor.isNativePlatform() && (
                                    <IonButton onClick={async () => await showAd()} shape='round' mode='ios' color='success'>
                                        <IonIcon icon={playOutline} className='mr-2' />
                                        <IonText>Watch Ads</IonText>
                                    </IonButton>
                                )}

                                {!Capacitor.isNativePlatform() && (
                                    <div className="px-16">
                                        <IonText className="albert-font mt-4 !font-normal leading-3" color="danger">Sorry, this feature only available for mobile apps.</IonText>
                                        <div className='block text-center mt-3'>
                                            <a className='inline-block' href={`https://play.google.com/store/apps/details?id=com.ritize.mobile`} target='_blank'>
                                                <img className='w-36 h-auto' src={`/icons/Google_Play_Store_badge_EN.svg`} />
                                            </a>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </IonContent>
        </IonPage>
    )
};

export default TokenRewardPage;