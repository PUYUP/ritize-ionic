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

import { briefcaseOutline, homeOutline, logOutOutline, peopleOutline, settingsOutline } from 'ionicons/icons';
import './Menu.css';
import { useLocation } from 'react-router';
import { useAuth } from '../utils/authContext';
import { useEffect, useState } from 'react';
import { getUser } from '../utils/authState';

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
        title: 'My Workspaces',
        url: '/dashboard/workspace',
        iosIcon: briefcaseOutline,
        mdIcon: briefcaseOutline
    },
    {
        title: 'Profile',
        url: '/dashboard/profile',
        iosIcon: peopleOutline,
        mdIcon: peopleOutline
    },
    {
        title: 'Settings',
        url: '/dashboard/settings',
        iosIcon: settingsOutline,
        mdIcon: settingsOutline
    },
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

    return (
        <IonMenu contentId="main" type="overlay">
            <IonContent>
                <IonList id="inbox-list" style={{ 'paddingTop': 'var(--ion-safe-area-top, 0)' }}>
                    <IonListHeader>{user?.name}</IonListHeader>
                    <IonNote>{user?.email}</IonNote>
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
                        <IonItem onClick={async () => logout()} routerDirection="none" lines="none" detail={false}>
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
