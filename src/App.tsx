import { IonApp, IonRouterOutlet, IonSplitPane, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import Menu from './components/Menu';

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
 */
import '@ionic/react/css/palettes/dark.system.css';

/* Theme variables */
import './theme/variables.css';
import { useEffect, useState } from 'react';
import { dashboardRoutes } from './routes/dashboard.routes';
import { mainRoutes } from './routes/main.routes';
import { SocialLogin } from '@capgo/capacitor-social-login';
import { Route, useLocation } from 'react-router'; // Tambahkan useLocation
import ProtectedRoute from './routes/ProtectedRoute';
import { AuthProvider } from './utils/authContext';

setupIonicReact({ mode: "md", animated: false });

// Buat komponen layout terpisah agar bisa menggunakan useLocation
const AppLayout: React.FC = () => {
	const location = useLocation();

	// Daftar path di mana menu harus disembunyikan
	const hideMenuPaths = ['/', '/oauth-google'];

	// Cek apakah pathname saat ini ada di dalam daftar hideMenuPaths
	const hideMenu = hideMenuPaths.includes(location.pathname);

	return (
		// Matikan efek SplitPane (when={false}) jika hideMenu bernilai true
		<IonSplitPane contentId="main" when={hideMenu ? false : 'md'}>
			{!hideMenu && <Menu />}
			<IonRouterOutlet id="main">
				{mainRoutes.map((route) => (
					<Route key={route.path as string} {...route} />
				))}

				{dashboardRoutes.map((route) => (
					<Route
						key={route.path as string}
						path={route.path}
						element={<ProtectedRoute>{route.element}</ProtectedRoute>}
					/>
				))}
			</IonRouterOutlet>
		</IonSplitPane>
	);
};

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
					iOSClientId: '1036154501218-7q37t2sk7uboql5tpfko5p1eqiis1c22.apps.googleusercontent.com',
					iOSServerClientId: '1036154501218-uonc708al3gm9bpr84i58ib3ojfon6sv.apps.googleusercontent.com',
					mode: 'online',
				}
			});
		})();
	}, []);

	return (
		<IonApp>
			<AuthProvider>
				<IonReactRouter>
					<AppLayout />
				</IonReactRouter>
			</AuthProvider>
		</IonApp>
	);
};

export default App;