import './Page.css';
import {
    IonAlert,
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonFooter,
    IonHeader,
    IonIcon,
    IonPage,
    IonText,
    IonTitle,
    IonToolbar,
    useIonToast,
    useIonViewDidEnter,
    useIonViewDidLeave,
    useIonViewWillLeave,
} from '@ionic/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type Quill from 'quill';
import { Delta, EmitterSource } from 'quill';
import QuillEditor, { type ImageUploadHandler } from '../../../../components/richtext/QuillEditor';
import { copyOutline, duplicateOutline, trashOutline } from 'ionicons/icons';
import { Note, Page } from '../../../../databases/entities/notes';
import Swiper from 'swiper';
import { FreeMode, Mousewheel } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/free-mode';
import NotesRepository from '../../../../databases/datasources/NotesRepository';

const AUTOSAVE_DELAY_MS = 1500;
const NOTE_ID = 2;

const RichTextEditorPage: React.FC = () => {
    const ionContentRef = useRef<HTMLIonContentElement>(null);
    const quillRef = useRef<Quill | null>(null);
    const autosaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const [isDirty, setIsDirty] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [hasContent, setHasContent] = useState(false);
    const [pages, setPages] = useState<Page[]>([]);
    const [clearSignal, setClearSignal] = useState(0);
    const [showClearAlert, setShowClearAlert] = useState(false);
    const [showRemoveAlert, setShowRemoveAlert] = useState(false);
    const [presentToast] = useIonToast();

    const [selectedNote, setSelectedNote] = useState<Note | null>(null);
    const [selectedPage, setSelectedPage] = useState<Partial<Page> | null>(null);

    const pagesSwiperElRef = useRef<HTMLDivElement>(null);
    const pagesSwiperRef = useRef<Swiper | null>(null);
    const prevPagesLengthRef = useRef(pages.length);

    // TODO: load real content (API call, Capacitor Preferences, IndexedDB…)
    const [initialContent, setInitialContent] = useState<Delta | undefined>(undefined);

    const persist = useCallback(async () => {
        console.log(selectedPage)
        const quill = quillRef.current;
        if (!quill || !selectedPage) return;
        setIsSaving(true);
        try {
            const delta = quill.getContents();
            const bufferData = Buffer.from(JSON.stringify(delta), 'utf-8');
            console.log('saved!');

            if (selectedPage) {
                await NotesRepository.updatePage(selectedPage.id as number, { contentData: bufferData });
                console.log('selected page id: ', selectedPage.id, ' is updated');

                // GUNAKAN CARA INI (Functional Update)
                // Cara ini paling aman karena tidak membutuhkan variabel 'pages' dari luar closure
                setPages((prevPages) =>
                    prevPages.map(p =>
                        p.id === selectedPage.id ? { ...p, contentData: bufferData } : p
                    )
                );
            }

            setIsDirty(false);
        } catch (err) {
            console.error('Failed to save document', err);
            presentToast({ message: 'Could not save your changes.', duration: 2500, color: 'danger' });
        } finally {
            setIsSaving(false);
        }
    }, [presentToast, selectedPage]);

    const handleTextChange = useCallback((
        delta: Delta,
        oldDelta: Delta,
        source: EmitterSource,
        quill: Quill
    ) => {
        setIsDirty(true);

        if (!hasContent && delta.ops.length > 0) {
            setHasContent(true);
        }

        if (delta.ops.length <= 1) {
            setHasContent(false);
        }

        if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
        autosaveTimer.current = setTimeout(persist, AUTOSAVE_DELAY_MS);
    }, [persist]);

    const handleEnter = useCallback((quill: Quill) => {
        ionContentRef.current?.scrollToBottom(0);
    }, []);

    // Ionic's router outlet keeps pages mounted in its history stack, so plain
    // unmount isn't a reliable "user is leaving" signal — flush explicitly.
    useIonViewWillLeave(() => {
        if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
        if (isDirty) void persist();
    });

    useEffect(() => () => {
        if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    }, []);

    const handleImageUpload: ImageUploadHandler = useCallback(async (file) => {
        // TODO: upload to real storage (S3, Cloudinary, your API…) and return the URL.
        // This base64 fallback works out of the box for testing, but embedding
        // images as base64 bloats the saved document — replace before shipping.
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }, []);

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
                    direction: 'horizontal',
                    slidesPerView: 'auto',
                    spaceBetween: 8, // Jarak antar item (pengganti gap-4)
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

    // load content data from database
    useEffect(() => {
        console.log("loadContentData useEffect triggered", { selectedPage: selectedPage?.id });
        if (!selectedPage) return;

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
                    console.log("JSON parsed successfully, elements count:", json);

                    // SET LANGSUNG KE INSTANCE QUILL
                    if (quillRef.current) {
                        // Gunakan setContents, BUKAN setInitialContent
                        quillRef.current.setContents(new Delta(json));
                    }

                } catch (error) {
                    console.error("Gagal melakukan parse JSON:", error);
                }
            } else {
                console.log("contentData is empty/falsy, setting empty elements array");
                // PENTING: Kosongkan editor jika halaman ini belum ada kontennya
                if (quillRef.current) {
                    quillRef.current.setContents(new Delta());
                }
            }
        }

        loadContentData();
    }, [selectedPage]);

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

    // select page
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
            <IonHeader className="ion-no-border">
                <IonToolbar>
                    <IonButtons slot="start" className="ion-padding-start">
                        <IonBackButton defaultHref="/" />
                    </IonButtons>

                    <IonTitle className='text-base ion-padding-start ion-padding-end line-clamp-1'>Kimia Jaya Analisis Teknik Dasar Terapan Dr. Fitri</IonTitle>

                    {/* pages tools */}
                    <div slot="end" className='flex flex-row items-center gap-3 z-60 ion-padding-end'>
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

            <IonContent ref={ionContentRef} className='relative'>
                <QuillEditor
                    ref={quillRef}
                    defaultValue={initialContent}
                    placeholder="Tap here to start…"
                    onTextChange={handleTextChange}
                    onImageUpload={handleImageUpload}
                    clearSignal={clearSignal}
                    onEnter={handleEnter}
                    className="quill-editor-container"
                />
            </IonContent>

            <IonFooter>
                <div style={{ 'paddingBottom': 'var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0))' }}>
                    <div className='flex flex-row gap-2 items-center justify-between h-full px-2 py-2'>
                        <div className='flex-1 overflow-hidden'>
                            <div ref={pagesSwiperElRef} className='swiper !px-2'>
                                <div id="pages-list" className='swiper-wrapper flex flex-row pb-1'>
                                    {pages.map((page) => (
                                        <div key={page.id} className='swiper-slide !h-auto !w-auto flex-none'>
                                            <IonButton
                                                size='small'
                                                shape="round"
                                                color={page.isActive ? 'light' : 'light'}
                                                onClick={async () => await selectPageHandler(page)}
                                                className={`font-normal ${page.isActive ? 'font-semibold page-active' : ''}`}
                                            >
                                                <IonText slot='icon-only'>{page.pageNum}</IonText>
                                            </IonButton>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className='flex items-center pb-1 pr-2'>
                            <IonButton size='small' shape="round" color={'light'} onClick={async () => await newPageHandler()}>
                                <IonIcon icon={duplicateOutline} slot='icon-only'></IonIcon>
                            </IonButton>
                        </div>
                    </div>
                </div>
            </IonFooter>

            {/* clear content alert */}
            <IonAlert
                isOpen={showClearAlert}
                onDidDismiss={() => setShowClearAlert(false)}
                header='Are you sure to clear content?'
                message={'All your current notes content will be permanently deleted.'}
                buttons={[
                    { text: 'Cancel', role: 'cancel' },
                    {
                        text: 'Yes',
                        role: 'destructive',
                        handler: async () => {
                            setClearSignal((c) => c + 1);
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
                                setClearSignal((c) => c + 1);
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

export default RichTextEditorPage;