import {
    IonContent,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonListHeader,
    IonMenu,
    IonMenuToggle,
    IonNote,
} from '@ionic/react';

import { briefcaseOutline, homeOutline, logOutOutline, medicalOutline, peopleOutline, schoolOutline, settingsOutline, skullOutline } from 'ionicons/icons';
import './Menu.css';
import { useLocation } from 'react-router';
import { useAuth } from '../utils/authContext';
import { useEffect, useState } from 'react';
import { getUser } from '../utils/authState';
import { Preferences } from '@capacitor/preferences';

interface AppPage {
    url: string;
    iosIcon: string;
    mdIcon: string;
    title: string;
}

const appPages: AppPage[] = [
    {
        title: 'Dashboard',
        url: '/dashboard',
        iosIcon: homeOutline,
        mdIcon: homeOutline
    },
    {
        title: 'Classes',
        url: '/dashboard/workspace',
        iosIcon: schoolOutline,
        mdIcon: schoolOutline
    },
    // {
    //     title: 'Chat w/ Note',
    //     url: '/dashboard/chatbot',
    //     iosIcon: medicalOutline,
    //     mdIcon: medicalOutline,
    // },
    {
        title: 'Delete Account',
        url: '/dashboard/account-deletion',
        iosIcon: skullOutline,
        mdIcon: skullOutline
    },
    // {
    //     title: 'Profile',
    //     url: '/dashboard/profile',
    //     iosIcon: peopleOutline,
    //     mdIcon: peopleOutline
    // },
    // {
    //     title: 'Settings',
    //     url: '/dashboard/settings',
    //     iosIcon: settingsOutline,
    //     mdIcon: settingsOutline
    // },
];

const Menu: React.FC = () => {
    const location = useLocation();
    const { logout } = useAuth();
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        const fetchUser = async () => {
            const user = await getUser();
            setUser(user);
        }
        fetchUser();
    }, []);

    const logoutHandler = async () => {
        await logout();
        // clear all cache from localforage
        await Preferences.clear();

        localStorage.removeItem('capgo_social_login_google_state');
    }

    return (
        <IonMenu contentId="main" type="overlay" className='border-r border-neutral-200'>
            <IonContent>
                <IonList id="inbox-list" style={{ 'paddingTop': 'var(--ion-safe-area-top, 0)' }}>
                    {/* <IonListHeader>{user?.name}</IonListHeader>
                    <IonNote>{user?.email}</IonNote> */}
                    <IonListHeader className='!text-2xl text-neutral-700 ion-margin-bottom'>Ritize!</IonListHeader>
                    {appPages.map((appPage, index) => {
                        return (
                            <IonMenuToggle key={index} autoHide={false}>
                                <IonItem className={location.pathname === appPage.url ? 'selected' : ''} routerLink={appPage.url} routerDirection="none" lines="none" detail={false}>
                                    <IonIcon aria-hidden="true" slot="start" ios={appPage.iosIcon} md={appPage.mdIcon} className='w-8`' color={appPage.title == 'Logout' ? 'danger' : ''} />
                                    <IonLabel className='pl-4' color={appPage.title == 'Logout' ? 'danger' : ''}>{appPage.title}</IonLabel>
                                </IonItem>
                            </IonMenuToggle>
                        );
                    })}

                    <IonMenuToggle key={'logout'} autoHide={false}>
                        <IonItem onClick={async () => logoutHandler()} routerDirection="none" lines="none" detail={false}>
                            <IonIcon aria-hidden="true" slot="start" ios={logOutOutline} md={logOutOutline} className='w-8`' color={'danger'} />
                            <IonLabel className='pl-4' color={'danger'}>Logout</IonLabel>
                        </IonItem>
                    </IonMenuToggle>
                </IonList>
            </IonContent>
        </IonMenu>
    );
};

export default Menu;
