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
  IonToolbar,
  useIonViewDidEnter,
  useIonViewDidLeave,
} from '@ionic/react';
import { useParams } from 'react-router';
import { Excalidraw, MainMenu, serializeAsJSON } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import './Page.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import { copyOutline, duplicateOutline, trashOutline } from 'ionicons/icons';
import { useDeviceWidth } from '../../../utils/sizing';
import { debounceTime, Subject } from 'rxjs';
import { menuController } from '@ionic/core/components';

import Swiper from 'swiper';
import { FreeMode, Mousewheel } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/free-mode';
import { AppState, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { Note, Page } from '../../../databases/entities/notes';
import NotesRepository from '../../../databases/datasources/NotesRepository';

// Dumy note
const NOTE_ID: number = 1;

// Posisi & zoom yang dikunci — canvas selalu balik ke sini
const LOCKED_VIEW = { scrollX: 0, scrollY: 0, zoomValue: 1 };


const CanvasEditorPage: React.FC = () => {
  const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null);
  const [hasContent, setHasContent] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [selectedPage, setSelectedPage] = useState<Partial<Page> | null>(null);

  const { name = '' } = useParams<{ name: string; }>();
  const width = useDeviceWidth();

  const wrapperRef = useRef<HTMLDivElement>(null);
  const changeSubject = useRef(new Subject<{ elements: readonly ExcalidrawElement[]; appState: AppState; }>()).current;
  const lastSavedDataRef = useRef<string | null>(null);

  const [showClearAlert, setShowClearAlert] = useState(false);
  const [showRemoveAlert, setShowRemoveAlert] = useState(false);

  // multiple pages handler
  const [pages, setPages] = useState<Page[]>([]);

  const pagesSwiperElRef = useRef<HTMLDivElement>(null);
  const pagesSwiperRef = useRef<Swiper | null>(null);
  const prevPagesLengthRef = useRef(pages.length);

  // excalidraw setups
  const excalidrawAppProps = {
    appState: {
      currentItemStrokeWidth: 0.5,
      currentItemStrokeColor: '#1e1e1e',
      gridStep: width,
      activeTool: {
        type: 'freedraw' as const,
        customType: null,
        locked: false,
        lastActiveTool: null,
        fromSelection: false,
      },
      penMode: false,
      scrollX: LOCKED_VIEW.scrollX,
      scrollY: LOCKED_VIEW.scrollY,
      zoom: { value: LOCKED_VIEW.zoomValue as any },
    } as any
  }

  // add new page
  const newPageHandler = async () => {
    if (!selectedNote) return;

    const prevPages = [...pages.map((p: Page) => ({ ...p, isActive: false }))];
    await NotesRepository.updatePagesBulk(prevPages);

    // Buat halaman baru
    await createPage(selectedNote, pages.length + 1);

    // RE-FETCH dari database untuk memastikan kita mendapatkan ID yang benar
    const updatedPages = await NotesRepository.getPagesByNoteId(selectedNote.id);
    setPages(updatedPages);

    const activePage = updatedPages.find((p) => p.isActive);
    if (activePage) {
      setSelectedPage(activePage);
    }
  };

  const selectPageHandler = async (page: Page) => {
    const updatedPages = pages.map((p) => ({ ...p, isActive: p.id === page.id }));
    await NotesRepository.updatePagesBulk(updatedPages);
    setPages(updatedPages);

    // getting page from database agar kita mendapatkan contentData yang TERBARU
    if (selectedNote) {
      const currentPages = await NotesRepository.getPagesByNoteId(selectedNote.id);
      setPages(currentPages);

      // CARI halaman yang dituju dari data yang FRESH ini
      const freshSelectedPage = currentPages.find(p => p.id === page.id);
      if (freshSelectedPage) {
        // Update state selectedPage dengan data TERBARU (termasuk coretan terakhir)
        setSelectedPage(freshSelectedPage);
      }
    }
  }

  useEffect(() => {
    const containerEl = pagesSwiperElRef.current;
    if (!containerEl) return;

    const isNewPageAdded = pages.length > prevPagesLengthRef.current;
    prevPagesLengthRef.current = pages.length;

    // Tunggu 1 frame agar DOM selesai me-render item baru
    const raf = requestAnimationFrame(async () => {
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
  // useEffect(() => {
  //   const el = wrapperRef.current;
  //   if (!el) return;

  //   const blockWheel = (e: WheelEvent) => {
  //     if (pagesSwiperElRef.current?.contains(e.target as Node)) return;
  //     e.preventDefault();
  //     e.stopPropagation();
  //   };

  //   // 1 jari tetap bebas untuk menggambar, 2+ jari (pinch/pan) diblokir
  //   const blockMultiTouch = (e: TouchEvent) => {
  //     if (e.touches.length > 1) {
  //       e.preventDefault();
  //       e.stopPropagation();
  //     }
  //   };

  //   // gesturestart/gesturechange: event khusus Safari saat pinch dimulai
  //   const blockGesture = (e: Event) => {
  //     e.preventDefault();
  //     e.stopPropagation();
  //   };

  //   el.addEventListener('wheel', blockWheel, { passive: false, capture: true });
  //   el.addEventListener('touchstart', blockMultiTouch, { passive: false, capture: true });
  //   el.addEventListener('touchmove', blockMultiTouch, { passive: false, capture: true });
  //   el.addEventListener('gesturestart', blockGesture as EventListener);
  //   el.addEventListener('gesturechange', blockGesture as EventListener);

  //   return () => {
  //     el.removeEventListener('wheel', blockWheel, true);
  //     el.removeEventListener('touchstart', blockMultiTouch, true);
  //     el.removeEventListener('touchmove', blockMultiTouch, true);
  //     el.removeEventListener('gesturestart', blockGesture as EventListener);
  //     el.removeEventListener('gesturechange', blockGesture as EventListener);
  //   };
  // }, []);

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

  const selectedPageId = selectedPage?.id;

  useEffect(() => {
    const subscription = changeSubject
      .pipe(debounceTime(250))
      .subscribe(async ({ elements, appState }) => {
        if (!excalidrawAPI || !selectedPage) return;

        const _appState = excalidrawAPI.getAppState();
        const files = excalidrawAPI.getFiles();

        // json ini tipenya adalah string
        const json = serializeAsJSON(elements, _appState, files, 'local');

        // MENCEGAH INFINITE LOOP: 
        // Jika JSON yang baru sama persis dengan yang terakhir disimpan, batalkan proses!
        if (lastSavedDataRef.current === json) {
          return;
        }

        // Jika berbeda, perbarui referensi dengan JSON yang baru
        lastSavedDataRef.current = json;

        // UBAH: Convert string JSON langsung ke Node.js Buffer
        const bufferData = Buffer.from(json, 'utf-8');

        // update contentData menggunakan bufferData
        if (selectedPageId) {
          await NotesRepository.updatePage(selectedPageId, { contentData: bufferData });
          console.log('selected page id: ', selectedPageId, ' is updated');

          // GUNAKAN CARA INI (Functional Update)
          // Cara ini paling aman karena tidak membutuhkan variabel 'pages' dari luar closure
          setPages((prevPages) =>
            prevPages.map(p =>
              p.id === selectedPageId ? { ...p, contentData: bufferData } : p
            )
          );
        }
      });

    return () => subscription.unsubscribe();
  }, [excalidrawAPI, changeSubject, selectedPageId]);

  // load content data from database
  useEffect(() => {
    console.log("loadContentData useEffect triggered", { hasExcalidraw: !!excalidrawAPI, selectedPage: selectedPage?.id });
    if (!excalidrawAPI || !selectedPage) return;

    const loadContentData = async () => {
      const contentData = selectedPage?.contentData;
      console.log("contentData type/length:", contentData ? (contentData as any).length || (contentData as any).byteLength : "null");

      if (contentData) {
        try {
          // 1. Ubah Uint8Array ke String menggunakan TextDecoder
          const decoder = new TextDecoder('utf-8');
          const jsonString = decoder.decode(contentData);

          if (!jsonString) {
            console.log("Decoded jsonString is empty");
            return;
          }

          // 2. Parse string yang sudah valid menjadi JSON object
          const json = JSON.parse(jsonString);
          console.log("JSON parsed successfully, elements count:", json.elements?.length);

          // Jika Anda ingin mengembalikan datanya ke Excalidraw:
          if (excalidrawAPI) {
            console.log("Calling updateScene with elements from DB (deferred)");

            setTimeout(() => {
              excalidrawAPI.updateScene({
                elements: json.elements,
                appState: {
                  ...json.appState,
                  ...excalidrawAppProps.appState
                },
              });
            }, 100);
          }

        } catch (error) {
          console.error("Gagal melakukan parse JSON:", error);
        }
      } else {
        console.log("contentData is empty/falsy, setting empty elements array");
        // Jika data kosong (page baru), set dengan default appProps
        if (excalidrawAPI) {
          setTimeout(() => {
            excalidrawAPI.updateScene({
              elements: [],
              appState: excalidrawAppProps.appState
            });
          }, 100);
        }
      }
    }

    loadContentData();
  }, [selectedPage, excalidrawAPI]);

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
            ...excalidrawAPI.getAppState(),
            ...excalidrawAppProps.appState,
            scrollX: LOCKED_VIEW.scrollX,
            scrollY: LOCKED_VIEW.scrollY,
            zoom: { value: LOCKED_VIEW.zoomValue as any },
          },
        });
      }
    },
    [excalidrawAPI]
  );

  // component lifecycles
  useIonViewDidEnter(() => {
    window.dispatchEvent(new Event('resize'));

    // init note — run async logic without returning its promise
    (async () => {
      let note = await NotesRepository.getNoteById(NOTE_ID);
      if (note) {
        console.log('load note from database');
        setSelectedNote(note);
      }

      // check if note is null, then create a new note
      if (note === null) {
        console.log('create new note');
        note = await initNote("123456");
        setSelectedNote(note);

        const page = await createPage({ id: note.id }, 1);
        console.log('create page', page);
        setSelectedPage(page);
      }

      // get all pages
      if (note) {
        const currentPages = await NotesRepository.getPagesByNoteId(note.id);
        console.log('get pages');
        setPages([...currentPages]);

        // get active page
        const activePage = currentPages.find((p: Page) => p.isActive === true);
        if (activePage) {
          setSelectedPage(activePage);
          console.log('active page', activePage);
        }
      }
    })();
  });

  useIonViewDidLeave(() => {
    // reset the pages
    setPages([]);
  });

  // --- CRUD NOTES ---  
  const initNote = async (workspaceId: string) => {
    const entity = await NotesRepository.insertNote({ workspaceId: workspaceId });
    return entity;
  }

  const createPage = async (note: Partial<Note>, pageNum: number) => {
    const entity = await NotesRepository.addPage({ id: note.id }, {
      pageNum: pageNum,
      isActive: true,
    });

    return entity;
  }
  // --- END CRUD NOTES ---

  return (
    <IonPage>
      <IonHeader className='ion-no-border'>
        <IonToolbar className='fixed' style={{ '--min-height': '36px', 'top': '10px' }}>
          <IonButtons slot="start" className='ion-padding-start'>
            <IonBackButton defaultHref='/' />
          </IonButtons>

          {/* pages tools */}
          <div slot="end" className='flex flex-row items-center gap-3 absolute right-3 top-0 z-60'>
            <IonButton
              size='small'
              shape="round"
              color={'light'}
              disabled={!hasContent}
              onClick={() => setShowClearAlert(true)}
            >
              <IonIcon icon={copyOutline} slot='icon-only'></IonIcon>
            </IonButton>

            <IonButton
              size='small'
              shape="round"
              color={'light'}
              disabled={pages.length <= 1}
              onClick={() => setShowRemoveAlert(true)}
            >
              <IonIcon icon={trashOutline} slot='icon-only'></IonIcon>
            </IonButton>
          </div>
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
            aiEnabled={false}
            onExcalidrawAPI={(api: ExcalidrawImperativeAPI | null) => {
              setExcalidrawAPI(api);
              if (api) setIsLoaded(true);
            }}
            onChange={(elements, appState) => {
              const visibleElements = elements.filter((el) => !el.isDeleted);
              setHasContent(visibleElements.length > 0);

              if (!excalidrawAPI) return;
              changeSubject.next({ elements: elements, appState: appState });
            }}
            // onScrollChange={handleScrollChange}
            gridModeEnabled={true}
            zenModeEnabled={true}
            viewModeEnabled={false}
            UIOptions={{
              // @ts-ignore
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

          <div
            className='fixed w-[38px] right-2 bottom-[120px] z-10'
            style={{ 'top': 'calc(60px + var(--ion-safe-area-top, 0))', 'padding-bottom': 'var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0))' }}
          >
            <div className='flex flex-col gap-3 items-center justify-between h-full'>
              <div className='flex-1 pt-2 overflow-hidden'>
                <div ref={pagesSwiperElRef} className='swiper h-full w-full'>
                  <div id="pages-list" className='swiper-wrapper flex flex-col'>
                    {pages.map((page) => (
                      <div key={page.id} className='swiper-slide !h-auto !w-auto flex-none'>
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
        isOpen={showClearAlert}
        onDidDismiss={() => setShowClearAlert(false)}
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
                  ...excalidrawAPI.getAppState(),
                  ...excalidrawAppProps.appState,
                },
              });

              if (selectedPage) {
                const emptyJson = JSON.stringify({
                  type: "excalidraw/1.0",
                  version: 1,
                  source: "@excalidraw/excalidraw",
                  elements: [],
                  appState: { ...excalidrawAppProps.appState },
                });

                const emptyBuffer = Buffer.from(emptyJson, 'utf-8');

                setPages((prevPages) =>
                  prevPages.map(p =>
                    p.id === selectedPage.id ? { ...p, contentData: emptyBuffer } : p
                  )
                );

                // update selected page
                await NotesRepository.updatePage(selectedPage.id as number, {
                  contentData: emptyBuffer,
                });
              }
            },
          },
        ]}
      ></IonAlert>

      {/* remove page alert */}
      <IonAlert
        isOpen={showRemoveAlert}
        onDidDismiss={() => setShowRemoveAlert(false)}
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
                  appState: {
                    ...excalidrawAPI.getAppState(),
                    ...excalidrawAppProps.appState,
                  },
                });
                return;
              }

              // pilih page berikutnya kalau ada, atau page sebelumnya kalau yang dihapus adalah terakhir
              const nextActiveIndex = Math.min(activeIndex, filtered.length - 1);

              // delete page from db
              await NotesRepository.deletePage(pages[activeIndex].id);

              // re-index all pages
              const reindexed = filtered.map((p, idx) => ({
                ...p,
                pageNum: idx + 1,
                isActive: idx === nextActiveIndex,
              }));

              // set current active page
              const newSelected = reindexed.find((p) => p.isActive);
              if (newSelected) {
                await selectPageHandler(newSelected);
              }

              setPages(reindexed);
              await NotesRepository.updatePagesBulk(reindexed);
            },
          },
        ]}
      ></IonAlert>
    </IonPage>
  );
};

export default CanvasEditorPage;