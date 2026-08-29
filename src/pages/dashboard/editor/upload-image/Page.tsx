import { IonBackButton, IonButton, IonButtons, IonContent, IonFooter, IonHeader, IonIcon, IonPage, IonText, IonTitle, IonToolbar, useIonViewDidEnter, useIonViewDidLeave } from "@ionic/react";
import { cameraOutline, copyOutline, trashOutline } from "ionicons/icons";
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import Swiper from "swiper";
import 'swiper/css';
import 'swiper/css/pagination';
import './Page.css';
import { Note, Page } from "../../../../databases/entities/notes";
import { FreeMode, Mousewheel, Pagination, Thumbs } from "swiper/modules";
import NotesRepository from "../../../../databases/datasources/NotesRepository";

const NOTE_ID = 4;

interface RouteParams {
    id?: string
    name?: string
    [key: string]: string | undefined
}

const UploadImagePage: React.FC = () => {
    const { id } = useParams<RouteParams>();

    const [pages, setPages] = useState<Page[]>([]);
    const [selectedNote, setSelectedNote] = useState<Note | null>(null);
    const [selectedPage, setSelectedPage] = useState<Partial<Page> | null>(null);

    const pagesSwiperElRef = useRef<HTMLDivElement>(null);
    const thumbsSwiperElRef = useRef<HTMLDivElement>(null);
    const pagesSwiperRef = useRef<Swiper | null>(null);
    const thumbsSwiperRef = useRef<Swiper | null>(null);
    const prevPagesLengthRef = useRef(pages.length);

    const pagesRef = useRef<Page[]>([]);
    const selectedPageRef = useRef<Partial<Page> | null>(null);
    const selectedNoteRef = useRef<Note | null>(null);

    useEffect(() => { pagesRef.current = pages; }, [pages]);
    useEffect(() => { selectedPageRef.current = selectedPage; }, [selectedPage]);
    useEffect(() => { selectedNoteRef.current = selectedNote; }, [selectedNote]);

    useEffect(() => {
        const containerEl = pagesSwiperElRef.current;
        const thumbsContainerEl = thumbsSwiperElRef.current;
        if (!containerEl || !thumbsContainerEl) return;

        const isNewPageAdded = pages.length > prevPagesLengthRef.current;
        prevPagesLengthRef.current = pages.length;

        // Tunggu 1 frame agar DOM selesai me-render item baru
        const raf = requestAnimationFrame(async () => {
            // thumbs dulu
            if (!thumbsSwiperRef.current) {
                // Langsung inisialisasi Swiper tanpa syarat overflow
                thumbsSwiperRef.current = new Swiper(thumbsContainerEl, {
                    modules: [FreeMode, Mousewheel, Thumbs],
                    direction: 'horizontal',
                    slidesPerView: 'auto',
                    centerInsufficientSlides: true,
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
                    centeredSlides: true,
                    centeredSlidesBounds: true,
                });
            } else {
                // Jika Swiper sudah ada, cukup update state-nya saat ada page baru
                thumbsSwiperRef.current.update();

                // Scroll ke item paling bawah (indeks terakhir)
                // Parameter kedua (300) adalah durasi animasi dalam milidetik (opsional)
                // Cuma auto-scroll ke bawah kalau memang ada page baru
                if (isNewPageAdded) {
                    thumbsSwiperRef.current.slideTo(pages.length - 1, 300);
                }
            }

            // baru pages
            if (!pagesSwiperRef.current) {
                // Langsung inisialisasi Swiper tanpa syarat overflow
                pagesSwiperRef.current = new Swiper(containerEl, {
                    modules: [Pagination, FreeMode, Thumbs],
                    direction: 'horizontal',
                    slidesPerView: 1,
                    spaceBetween: 0,
                    centeredSlides: true,
                    resistanceRatio: 0,
                    watchOverflow: true, // Otomatis disable scroll jika item belum penuh
                    observer: true,
                    observeParents: true,
                    thumbs: { swiper: thumbsSwiperRef.current },
                    on: {
                        slideChange: (swiper) => {
                            handleActivePageChange(swiper.activeIndex);
                        },
                    },
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

        setPages((prevPages) =>
            prevPages.map((p) => {
                const nextActive = p.id === selectedPage?.id;
                // hanya buat objek baru kalau nilainya memang berubah
                return p.isActive === nextActive ? p : { ...p, isActive: nextActive };
            })
        );

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

                } catch (error) {
                    console.error("Gagal melakukan parse JSON:", error);
                }
            } else {
                console.log("contentData is empty/falsy, setting empty elements array");
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

    const handleActivePageChange = async (index: number) => {
        const page = pagesRef.current[index];
        if (!page) return;

        // sudah aktif (misal dipicu slideTo programatik dari newPageHandler) → skip, hindari kerja dobel
        if (selectedPageRef.current?.id === page.id) return;

        const updatedPages = pagesRef.current.map((p) => ({
            ...p,
            isActive: p.id === page.id,
        }));

        await NotesRepository.updatePagesBulk(updatedPages);
        setPages(updatedPages);

        const note = selectedNoteRef.current;
        if (note) {
            const currentPages = await NotesRepository.getPagesByNoteId(note.id);
            setPages(currentPages);

            const freshSelectedPage = currentPages.find((p) => p.id === page.id);
            if (freshSelectedPage) {
                setSelectedPage(freshSelectedPage);
            }
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
            <IonHeader className='ion-no-border'>
                <IonToolbar>
                    <IonButtons slot="start" className="ion-padding-start">
                        <IonBackButton defaultHref="/" />
                    </IonButtons>

                    <IonTitle className='text-base ion-padding-start ion-padding-end line-clamp-1'>Kimia Jaya Analisis Teknik Dasar Terapan Dr. Fitri</IonTitle>
                </IonToolbar>
            </IonHeader>

            <IonContent className="ion-padding" scrollY={false}>
                <div className="w-5/6 mx-auto">
                    <div ref={pagesSwiperElRef} className='swiper swiper-image'>
                        <div className="swiper-wrapper">
                            {pages.map((page) => (
                                <div key={page.id} className="swiper-slide !h-auto">
                                    <div className="relative w-full aspect-[1/1.6] bg-red-200">
                                        {page.id}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </IonContent>

            <IonFooter className="w-full py-2">
                <div style={{ paddingBottom: 'var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0))' }}>
                    <div className="flex items-center mb-3 mt-0 px-3">
                        <div className='w-auto pb-1'>
                            <IonButton
                                size='small'
                                shape="round"
                                color={'light'}
                                onClick={() => { }}
                            >
                                <IonIcon icon={copyOutline} slot='icon-only'></IonIcon>
                            </IonButton>
                        </div>

                        <div className='flex-1 overflow-hidden !px-3'>
                            <div ref={thumbsSwiperElRef} className='swiper swiper-image !px-2'>
                                <div id="pages-list" className='swiper-wrapper flex flex-row pb-1'>
                                    {pages.map((page, index) => (
                                        <div key={page.id} className='swiper-slide !h-auto !w-auto flex-none'>
                                            <IonButton
                                                size='small'
                                                shape="round"
                                                color={'light'}
                                                className={`font-normal ${page.isActive ? 'font-semibold page-active' : ''}`}
                                                onClick={() => pagesSwiperRef.current?.slideTo(index)}
                                            >
                                                <IonText slot='icon-only'>{page.pageNum}</IonText>
                                            </IonButton>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className='w-auto pb-1'>
                            <IonButton
                                size='small'
                                shape="round"
                                color={'light'}
                            >
                                <IonIcon icon={trashOutline} slot='icon-only'></IonIcon>
                            </IonButton>
                        </div>
                    </div>

                    <div className='flex items-center justify-between px-3'>
                        <div className='flex-1'>
                            <div className="flex justify-center gap-4">
                                <div className="flex items-center">
                                    <IonButton
                                        shape="round"
                                        size="large"
                                        color={'success'}
                                        onClick={newPageHandler}
                                    >
                                        <IonIcon icon={cameraOutline} slot="icon-only"></IonIcon>
                                    </IonButton>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </IonFooter>
        </IonPage>
    )
}

export default UploadImagePage;