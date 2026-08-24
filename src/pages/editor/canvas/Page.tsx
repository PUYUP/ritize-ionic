import {
  IonAlert,
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonPage,
  IonText,
  IonTitle,
  IonToolbar,
  useIonViewDidEnter
} from '@ionic/react';
import { useParams } from 'react-router';
import { Excalidraw, MainMenu } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import './Page.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/dist/types/excalidraw/types';
import { clipboardOutline } from 'ionicons/icons';

// Posisi & zoom yang dikunci — canvas selalu balik ke sini
const LOCKED_VIEW = { scrollX: 0, scrollY: 0, zoomValue: 1 };

const CanvasEditorPage: React.FC = () => {
  const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null);
  const [hasContent, setHasContent] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const strokeFixTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { name = '' } = useParams<{ name: string; }>();

  useIonViewDidEnter(() => {
    window.dispatchEvent(new Event('resize'));
  });

  // Lapis 1: cegah gesture zoom/pan sebelum sempat diproses Excalidraw
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const blockWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    // 1 jari tetap bebas untuk menggambar, 2+ jari (pinch/pan) diblokir
    const blockMultiTouch = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    // gesturestart/gesturechange: event khusus Safari saat pinch dimulai
    const blockGesture = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };

    el.addEventListener('wheel', blockWheel, { passive: false, capture: true });
    el.addEventListener('touchstart', blockMultiTouch, { passive: false, capture: true });
    el.addEventListener('touchmove', blockMultiTouch, { passive: false, capture: true });
    el.addEventListener('gesturestart', blockGesture as EventListener);
    el.addEventListener('gesturechange', blockGesture as EventListener);

    return () => {
      el.removeEventListener('wheel', blockWheel, true);
      el.removeEventListener('touchstart', blockMultiTouch, true);
      el.removeEventListener('touchmove', blockMultiTouch, true);
      el.removeEventListener('gesturestart', blockGesture as EventListener);
      el.removeEventListener('gesturechange', blockGesture as EventListener);
    };
  }, []);

  // Lapis 2: kalau tetap ada perubahan scroll/zoom yang lolos, langsung dikembalikan
  const handleScrollChange = useCallback(
    (scrollX: number, scrollY: number, zoom: { value: number }) => {
      if (
        scrollX !== LOCKED_VIEW.scrollX ||
        scrollY !== LOCKED_VIEW.scrollY ||
        zoom.value !== LOCKED_VIEW.zoomValue
      ) {
        excalidrawAPI?.updateScene({
          appState: {
            scrollX: LOCKED_VIEW.scrollX,
            scrollY: LOCKED_VIEW.scrollY,
            zoom: { value: LOCKED_VIEW.zoomValue as any },
          },
        });
      }
    },
    [excalidrawAPI]
  );

  return (
    <IonPage>
      <IonHeader className='ion-no-border'>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref='/' />
          </IonButtons>
          <IonTitle>{name}</IonTitle>
          <IonButtons slot="end" className='ion-padding-end'>
            <IonButton mode='ios' id="clear-canvas" color={'danger'} size='small' disabled={!hasContent}>
              <IonIcon icon={clipboardOutline} slot='start'></IonIcon>
              <IonText>Reset</IonText>
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen scrollY={false}>
        <div
          ref={wrapperRef}
          className='relative'
          style={{
            width: "100%",
            height: "100%",
            touchAction: 'none', // cegah browser native pinch/scroll di area ini
            opacity: isLoaded ? 1 : 0,
            transition: 'opacity 0.2s ease-in-out'
          }}
        >
          <Excalidraw
            autoFocus
            aiEnabled={true}
            onExcalidrawAPI={(api: ExcalidrawImperativeAPI) => {
              setExcalidrawAPI(api);
              setIsLoaded(true);
            }}
            onChange={(elements) => {
              const visibleElements = elements.filter((el) => !el.isDeleted);
              setHasContent(visibleElements.length > 0);
            }}
            onScrollChange={handleScrollChange}
            initialData={{
              appState: {
                currentItemStrokeWidth: 0.5,
                activeTool: {
                  type: 'freedraw',
                  customType: null,
                  locked: false,
                  lastActiveTool: null,
                },

                penMode: false,
                scrollX: LOCKED_VIEW.scrollX,
                scrollY: LOCKED_VIEW.scrollY,
                zoom: { value: LOCKED_VIEW.zoomValue as any },
              }
            }}
            gridModeEnabled={true}
            zenModeEnabled={true}
            viewModeEnabled={false}
            UIOptions={{
              getFormFactor: () => 'phone',
              canvasActions: {
                export: false,
                toggleTheme: false,
                loadScene: false,
                saveAsImage: false,
                saveToActiveFile: false,
                changeViewBackgroundColor: false,
              },
            }}
            renderTopRightUI={() => <></>}
          >
            <MainMenu>
              <MainMenu.DefaultItems.ClearCanvas />
            </MainMenu>
          </Excalidraw>
        </div>
      </IonContent>

      <IonAlert
        trigger="clear-canvas"
        header='Are you sure to clear canvas?'
        message={'All your current drawing will be permanently deleted.'}
        buttons={[
          { text: 'Cancel', role: 'cancel' },
          {
            text: 'Yes',
            role: 'destructive',
            handler: async () => {
              await excalidrawAPI?.resetScene();
              excalidrawAPI?.updateScene({
                appState: {
                  activeTool: {
                    type: 'freedraw',
                    locked: false,
                    lastActiveTool: null,
                    customType: null,
                  },
                  currentItemStrokeWidth: 0.5,
                }
              });
            },
          },
        ]}
      ></IonAlert>
    </IonPage>
  );
};

export default CanvasEditorPage;