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
  useIonViewDidEnter,
  useIonViewDidLeave,
  withIonLifeCycle
} from '@ionic/react';
import { useParams } from 'react-router';
import { Excalidraw, Footer, MainMenu, serializeAsJSON } from '@excalidraw/excalidraw';
import type { ExcalidrawElement } from '@excalidraw/element/types';
import '@excalidraw/excalidraw/index.css';
import './Page.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/dist/types/excalidraw/types';
import { clipboard, clipboardOutline, copyOutline, copySharp, duplicateOutline, duplicateSharp, removeCircle, removeCircleOutline, trashBinSharp, trashOutline } from 'ionicons/icons';
import { useDeviceWidth } from '../../../utils/sizing';
import { debounceTime, Subject } from 'rxjs';
import { menuController } from '@ionic/core/components';

import Swiper from 'swiper';
import { FreeMode, Mousewheel } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/free-mode';

// Interfaces
interface PageLayer {
  pageNum: number;
  canvasId: string;
  isActive: boolean;
}

// Posisi & zoom yang dikunci — canvas selalu balik ke sini
const LOCKED_VIEW = { scrollX: 0, scrollY: 0, zoomValue: 1 };

const CanvasEditorPage: React.FC = () => {
  const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null);
  const [hasContent, setHasContent] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const { name = '' } = useParams<{ name: string; }>();
  const width = useDeviceWidth();

  const wrapperRef = useRef<HTMLDivElement>(null);
  const changeSubject = useRef(new Subject<readonly ExcalidrawElement[]>()).current;

  // multiple pages handler
  const [pages, setPages] = useState<PageLayer[]>([
    { pageNum: 1, canvasId: 'canvas-1', isActive: true },
  ]);

  const pagesSwiperElRef = useRef<HTMLDivElement>(null);
  const pagesSwiperRef = useRef<Swiper | null>(null);
  const prevPagesLengthRef = useRef(pages.length);

  // add new page
  const newPageHandler = async () => {
    setPages([
      ...pages.map((page) => ({ ...page, isActive: false })),
      {
        pageNum: pages.length + 1,
        canvasId: `canvas-${pages.length + 1}`,
        isActive: true,
      },
    ]);
  };

  const selectPageHandler = async (page: PageLayer) => {
    setPages(pages.map((p) => ({ ...p, isActive: p.canvasId === page.canvasId })));
  }

  useEffect(() => {
    const containerEl = pagesSwiperElRef.current;
    if (!containerEl) return;

    const isNewPageAdded = pages.length > prevPagesLengthRef.current;
    prevPagesLengthRef.current = pages.length;

    // Tunggu 1 frame agar DOM selesai me-render item baru
    const raf = requestAnimationFrame(() => {
      if (!pagesSwiperRef.current) {
        // Langsung inisialisasi Swiper tanpa syarat overflow
        pagesSwiperRef.current = new Swiper(containerEl, {
          modules: [FreeMode, Mousewheel],
          direction: 'vertical',
          slidesPerView: 'auto',
          spaceBetween: 6, // Jarak antar item (pengganti gap-4)
          freeMode: {
            enabled: true,
            momentum: true,
            momentumBounce: false,
            sticky: false,
          },
          mousewheel: {
            forceToAxis: true,
            releaseOnEdges: true,
          },
          resistanceRatio: 0,
          watchOverflow: true, // Otomatis disable scroll jika item belum penuh
          observer: true,
          observeParents: true,
        });
      } else {
        // Jika Swiper sudah ada, cukup update state-nya saat ada page baru
        pagesSwiperRef.current.update();

        // Scroll ke item paling bawah (indeks terakhir)
        // Parameter kedua (300) adalah durasi animasi dalam milidetik (opsional)
        // Cuma auto-scroll ke bawah kalau memang ada page baru
        if (isNewPageAdded) {
          pagesSwiperRef.current.slideTo(pages.length - 1, 300);
        }
      }
    });

    return () => cancelAnimationFrame(raf);
  }, [pages]);

  useEffect(() => {
    return () => {
      pagesSwiperRef.current?.destroy(true, true);
      pagesSwiperRef.current = null;
    };
  }, []);
  // end...

  useEffect(() => {
    menuController.swipeGesture(false);
    return () => {
      menuController.swipeGesture(true);
    };
  }, []);

  // Lapis 1: cegah gesture zoom/pan sebelum sempat diproses Excalidraw
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const blockWheel = (e: WheelEvent) => {
      if (pagesSwiperElRef.current?.contains(e.target as Node)) return;
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

  // add custom button
  useEffect(() => {
    if (!isLoaded || !wrapperRef.current) return;

    setTimeout(() => {
      const mobileToolbarDiv = wrapperRef.current?.querySelector(
        '.App-bottom-bar .mobile-toolbar'
      ) as HTMLElement | null;

      if (mobileToolbarDiv) {
        // 2. Simpan fungsi asli agar tidak terjadi Infinite Loop
        const originalGetBoundingClientRect = mobileToolbarDiv.getBoundingClientRect.bind(mobileToolbarDiv);

        // 3. Timpa method getBoundingClientRect
        mobileToolbarDiv.getBoundingClientRect = () => {
          const rect = originalGetBoundingClientRect();
          const extra = 200;
          const width = rect.width + extra;

          const patched: DOMRect = {
            x: rect.x,
            y: rect.y,
            width,
            height: rect.height,
            top: rect.top,
            left: rect.left,
            right: rect.left + width,
            bottom: rect.bottom,
            toJSON() {
              return {
                x: this.x, y: this.y, width: this.width, height: this.height,
                top: this.top, right: this.right, bottom: this.bottom, left: this.left
              };
            },
          };

          return patched;
        };

        // 4. PENTING: Paksa Excalidraw membaca ulang setToolbarWidth(...)
        window.dispatchEvent(new Event('resize'));
      }
    }, 100);
  }, [isLoaded]);

  useEffect(() => {
    const subscription = changeSubject
      .pipe(debounceTime(500)) // atur delay sesuai kebutuhan
      .subscribe((elements) => {
        if (!excalidrawAPI) return;

        const appState = excalidrawAPI.getAppState();
        const files = excalidrawAPI.getFiles();
        const json = serializeAsJSON(elements, appState, files, 'local');

        const blob = new Blob([json], { type: 'application/json' });
        console.log(blob);
      });

    return () => subscription.unsubscribe();
  }, [excalidrawAPI, changeSubject]);

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

  // excalidraw setups
  const excalidrawAppProps = {
    appState: {
      currentItemStrokeWidth: 0.5,
      gridStep: width,
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
  }

  // component lifecycles
  useIonViewDidEnter(() => {
    window.dispatchEvent(new Event('resize'));
  });

  useIonViewDidLeave(() => {
    // reset the pages
    setPages([{ pageNum: 1, canvasId: 'canvas-1', isActive: true }]);
  });

  return (
    <IonPage>
      <div className='!absolute left-3 top-3 ion-no-border z-50'>
        <IonBackButton defaultHref='/' />
      </div>

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
            aiEnabled={false}
            onExcalidrawAPI={(api: ExcalidrawImperativeAPI) => {
              setExcalidrawAPI(api);
              setIsLoaded(true);
            }}
            onChange={(elements) => {
              const visibleElements = elements.filter((el) => !el.isDeleted);
              setHasContent(visibleElements.length > 0);

              if (!excalidrawAPI) return;
              changeSubject.next(elements);
            }}
            onScrollChange={handleScrollChange}
            initialData={excalidrawAppProps}
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

            <Footer>
              <button
                className="custom-footer"
                onClick={() => alert("This is dummy footer")}
              >
                custom footer
              </button>
            </Footer>
          </Excalidraw>

          {/* pages tools */}
          <div className='flex flex-row items-center gap-3 absolute right-3 top-3 z-60'>
            <IonButton
              size='small'
              id="clear-canvas"
              shape="round"
              color={'light'}
              disabled={!hasContent}
            >
              <IonIcon icon={copyOutline} slot='icon-only'></IonIcon>
            </IonButton>

            <IonButton
              size='small'
              id="remove-page"
              shape="round"
              color={'light'}
              disabled={pages.length <= 1}
            >
              <IonIcon icon={trashOutline} slot='icon-only'></IonIcon>
            </IonButton>
          </div>

          <div className='fixed w-[38px] right-2 top-[60px] bottom-[120px] z-60'>
            <div className='flex flex-col gap-2 items-center justify-between h-full'>
              <div className='flex-1 pt-2 overflow-hidden'>
                <div ref={pagesSwiperElRef} className='swiper h-full w-full'>
                  <div id="pages-list" className='swiper-wrapper flex flex-col'>
                    {pages.map((page) => (
                      <div key={page.canvasId} className='swiper-slide !h-auto !w-auto flex-none'>
                        <IonButton
                          size='small'
                          shape="round"
                          color={page.isActive ? 'light' : 'light'}
                          onClick={async () => await selectPageHandler(page)}
                          className={`mb-2 font-normal ${page.isActive ? 'font-semibold page-active' : ''}`}
                        >
                          <IonText slot='icon-only'>{page.pageNum}</IonText>
                        </IonButton>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <IonButton size='small' shape="round" color={'light'} onClick={async () => await newPageHandler()}>
                  <IonIcon icon={duplicateOutline} slot='icon-only'></IonIcon>
                </IonButton>
              </div>
            </div>
          </div>
        </div>
      </IonContent>

      {/* clear canvas alert */}
      <IonAlert
        trigger="clear-canvas"
        header='Are you sure to clear canvas?'
        message={'All your current notes will be permanently deleted.'}
        buttons={[
          { text: 'Cancel', role: 'cancel' },
          {
            text: 'Yes',
            role: 'destructive',
            handler: async () => {
              await excalidrawAPI?.resetScene();
              excalidrawAPI?.updateScene({
                appState: {
                  ...excalidrawAppProps.appState,
                },
              });
            },
          },
        ]}
      ></IonAlert>

      {/* remove page alert */}
      <IonAlert
        trigger="remove-page"
        header='Are you sure to remove this page?'
        message={'All your current notes on this page will be permanently deleted.'}
        buttons={[
          { text: 'Cancel', role: 'cancel' },
          {
            text: 'Yes',
            role: 'destructive',
            handler: async () => {
              const activeIndex = pages.findIndex((p) => p.isActive);
              if (activeIndex === -1) return;

              const filtered = pages.filter((_, idx) => idx !== activeIndex);

              // tidak ada page tersisa -> clear canvas
              if (filtered.length === 0) {
                setPages([]);
                await excalidrawAPI?.resetScene();
                excalidrawAPI?.updateScene({
                  appState: { ...excalidrawAppProps.appState },
                });
                return;
              }

              // pilih page berikutnya kalau ada, atau page sebelumnya kalau yang dihapus adalah terakhir
              const nextActiveIndex = Math.min(activeIndex, filtered.length - 1);

              const reindexed = filtered.map((p, idx) => ({
                ...p,
                pageNum: idx + 1,
                isActive: idx === nextActiveIndex,
              }));

              setPages(reindexed);
            },
          },
        ]}
      ></IonAlert>
    </IonPage>
  );
};

export default withIonLifeCycle(CanvasEditorPage);