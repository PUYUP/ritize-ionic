import { IonApp, IonRouterOutlet, IonSplitPane, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { Navigate, Route } from 'react-router-dom';
import Menu from './components/Menu';
import Page from './pages/Page';
import CanvasEditorPage from './pages/dashboard/editor/canvas/Page';
import RichTextEditorPage from './pages/dashboard/editor/richtext/Page';


/* Core CSS required for Ionic components to work properly */
import '@ionic/react/css/core.css';

/* Basic CSS for apps built with Ionic */
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';

/* Optional CSS utils that can be commented out */
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';

/**
 * Ionic Dark Mode
 * -----------------------------------------------------
 * For more info, please see:
 * https://ionicframework.com/docs/theming/dark-mode
 */

/* import '@ionic/react/css/palettes/dark.always.css'; */
/* import '@ionic/react/css/palettes/dark.class.css'; */
import '@ionic/react/css/palettes/dark.system.css';

/* Theme variables */
import './theme/variables.css';
import { useEffect, useState } from 'react';
import { dashboardRoutes } from './routes/dashboard.routes';
import { mainRoutes } from './routes/main.routes';
import { SocialLogin } from '@capgo/capacitor-social-login';

setupIonicReact({ mode: "md", animated: false });

const App: React.FC = () => {
  const [fontReady, setFontReady] = useState(false);

  useEffect(() => {
    const font = new FontFace('Excalifont', 'url(/fonts/Inter-Regular.woff2)');
    font.load()
      .then((loadedFont) => {
        document.fonts.add(loadedFont);
        setFontReady(true);
        console.log('Font berhasil di-load:', loadedFont.status);
      })
      .catch((err) => {
        console.error('Font GAGAL di-load:', err);
      });

    // google oauth initializing
    (async () => {
      await SocialLogin.initialize({
        google: {
          webClientId: '1036154501218-uonc708al3gm9bpr84i58ib3ojfon6sv.apps.googleusercontent.com',
          mode: 'online',
        }
      });
    })()
  }, []);

  return (
    <IonApp>
      <IonReactRouter>
        <IonSplitPane contentId="main" when={false}>
          <Menu />
          <IonRouterOutlet id="main">
            {mainRoutes.map((route) => (
              <Route key={route.path as string} {...route} />
            ))}

            {dashboardRoutes.map((route) => (
              <Route key={route.path as string} {...route} />
            ))}
          </IonRouterOutlet>
        </IonSplitPane>
      </IonReactRouter>
    </IonApp>
  );
};

export default App;
