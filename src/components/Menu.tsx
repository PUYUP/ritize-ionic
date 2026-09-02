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

import { briefcase, briefcaseOutline, home, homeOutline, people, peopleOutline, settingsOutline, settingsSharp } from 'ionicons/icons';
import './Menu.css';
import { useLocation } from 'react-router';

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
    title: 'Workspaces',
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

  return (
    <IonMenu contentId="main" type="overlay">
      <IonContent>
        <IonList id="inbox-list" style={{ 'paddingTop': 'var(--ion-safe-area-top, 0)' }}>
          <IonListHeader>Dashboard</IonListHeader>
          <IonNote>Muhammad Rahman</IonNote>
          {appPages.map((appPage, index) => {
            return (
              <IonMenuToggle key={index} autoHide={false}>
                <IonItem className={location.pathname === appPage.url ? 'selected' : ''} routerLink={appPage.url} routerDirection="none" lines="none" detail={false}>
                  <IonIcon aria-hidden="true" slot="start" ios={appPage.iosIcon} md={appPage.mdIcon} className='w-8`' />
                  <IonLabel className='pl-4'>{appPage.title}</IonLabel>
                </IonItem>
              </IonMenuToggle>
            );
          })}
        </IonList>
      </IonContent>
    </IonMenu>
  );
};

export default Menu;
