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
    IonSelect,
    IonSelectOption,
    IonText,
    IonTitle,
    IonToast,
    IonToolbar,
    useIonViewDidEnter,
    useIonViewDidLeave,
} from '@ionic/react';
import './Page.css';
import { useEffect, useRef, useState } from 'react';
import { languageOutline, micOutline, pauseOutline, stopOutline, trashOutline, warningOutline } from 'ionicons/icons';
import type { PluginListenerHandle } from '@capacitor/core';
import {
    SpeechRecognition,
    SpeechRecognitionListeningEvent,
    type SpeechRecognitionErrorEvent,
    type SpeechRecognitionPartialResultEvent,
} from '@capgo/capacitor-speech-recognition';
import { Note, Page } from '../../../../databases/entities/notes';
import NotesRepository from '../../../../databases/datasources/NotesRepository';
import Swiper from 'swiper';
import { FreeMode, Mousewheel } from 'swiper/modules';
import codes, { by639_1, by639_2T, by639_2B } from 'iso-language-codes';

const RECOGNITION_LANGUAGE = 'en';
const NOTE_ID = 3;

type RecorderStatus = 'idle' | 'listening' | 'paused';

const VoiceRecorderPage: React.FC = () => {
    const ionContentRef = useRef<HTMLIonContentElement>(null);

    const [isSupported, setIsSupported] = useState<boolean | null>(null);
    const [status, setStatus] = useState<RecorderStatus>('idle');
    const [language, setLanguage] = useState<{ code: string; name: string }>({ code: RECOGNITION_LANGUAGE, name: by639_1[RECOGNITION_LANGUAGE].name });

    const [transcript, setTranscript] = useState('');
    const [interimText, setInterimText] = useState('');

    const [toastMessage, setToastMessage] = useState<string | null>(null);

    // Refs untuk mencegah state hilang (Stale Closure) saat event listener dipanggil
    const statusRef = useRef<RecorderStatus>('idle');
    const transcriptRef = useRef<string>('');
    const interimTextRef = useRef<string>('');

    const partialListenerRef = useRef<PluginListenerHandle | null>(null);
    const errorListenerRef = useRef<PluginListenerHandle | null>(null);
    const stateListenerRef = useRef<PluginListenerHandle | null>(null);

    const [showRemoveAlert, setShowRemoveAlert] = useState(false);
    const [pages, setPages] = useState<Page[]>([]);
    const [selectedNote, setSelectedNote] = useState<Note | null>(null);
    const [selectedPage, setSelectedPage] = useState<Partial<Page> | null>(null);

    const pagesSwiperElRef = useRef<HTMLDivElement>(null);
    const pagesSwiperRef = useRef<Swiper | null>(null);
    const prevPagesLengthRef = useRef(pages.length);
    const selectLanguageRef = useRef<HTMLIonSelectElement>(null);

    // Helper Functions untuk update state dan ref sekaligus secara aman
    const updateStatus = (newStatus: RecorderStatus) => {
        statusRef.current = newStatus;
        setStatus(newStatus);
    };

    const updateTranscript = async (text: string) => {
        transcriptRef.current = text;
        setTranscript(text);
    };

    const updateInterimText = (text: string) => {
        interimTextRef.current = text;
        setInterimText(text);
    };

    useEffect(() => {
        checkSupport();

        return () => {
            cleanupListeners();
            SpeechRecognition.stop().catch(() => { });
        };
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

    const cleanupListeners = () => {
        partialListenerRef.current?.remove();
        errorListenerRef.current?.remove();
        stateListenerRef.current?.remove();
        partialListenerRef.current = null;
        errorListenerRef.current = null;
        stateListenerRef.current = null;
    };

    const joinText = (a: string, b: string) => {
        const trimA = a.trim();
        const trimB = b.trim();
        if (!trimA) return trimB;
        if (!trimB) return trimA;
        return `${trimA} ${trimB}`;
    };

    const checkSupport = async () => {
        try {
            const { available } = await SpeechRecognition.available();
            setIsSupported(available);
        } catch (error) {
            console.error('Failed to check speech recognition support', error);
            setIsSupported(false);
        }
    };

    const ensurePermission = async () => {
        const current = await SpeechRecognition.checkPermissions();
        if (current.speechRecognition === 'granted') return true;

        const requested = await SpeechRecognition.requestPermissions();
        return requested.speechRecognition === 'granted';
    };

    const executeStartNative = async () => {
        try {
            await SpeechRecognition.start({
                language: language.code,
                partialResults: true,
                popup: false, // Wajib false agar tidak muncul dialog Android berulang kali
            });
        } catch (error) {
            console.error('Failed executing native start', error);
        }
    };

    // Fungsi penting yang menggabungkan teks terakhir tanpa menghilangkan kata
    const lockInterimAndRestart = async () => {
        if (statusRef.current === 'listening') {
            // Kunci interim text ke main transcript (jika ada)
            if (interimTextRef.current.trim() !== '') {
                const combined = joinText(transcriptRef.current, interimTextRef.current);
                updateTranscript(combined);
                updateInterimText(''); // Kosongkan interim setelah berhasil dipindahkan
            }

            // Langsung panggil mesin lagi
            await executeStartNative();
        }
    };

    const attachListeners = async () => {
        if (!partialListenerRef.current) {
            partialListenerRef.current = await SpeechRecognition.addListener(
                'partialResults',
                async (event: SpeechRecognitionPartialResultEvent) => {
                    const matchText = event.matches?.[0] ?? '';
                    // PENTING: Jangan timpa interimText jika hasilnya kosong.
                    // Ini mencegah kata terakhir terhapus tepat sebelum auto-restart.
                    if (matchText.trim() !== '') {
                        updateInterimText(matchText);
                        await saveTextToDatabase(matchText);
                    }
                }
            );
        }

        if (!errorListenerRef.current) {
            errorListenerRef.current = await SpeechRecognition.addListener(
                'error',
                (event: SpeechRecognitionErrorEvent) => {
                    console.warn('Native error/timeout:', event);
                    // Timeout hening biasanya melempar error, kita tangkap dan restart
                    lockInterimAndRestart();
                }
            );
        }

        if (!stateListenerRef.current) {
            stateListenerRef.current = await SpeechRecognition.addListener(
                'listeningState',
                (event: SpeechRecognitionListeningEvent) => {
                    if (event.status === 'stopped') {
                        // Jika mesin mati, langsung kunci teks lalu restart lagi
                        lockInterimAndRestart();
                    }
                }
            );
        }
    };

    const startListening = async () => {
        if (isSupported === false) {
            setToastMessage('Device is not supporting this feature.');
            return;
        }

        const granted = await ensurePermission();
        if (!granted) {
            setToastMessage('Microphone access has been denied.');
            return;
        }

        // add new page if current page have content
        if (selectedPage && selectedPage?.contentData) {
            await newPageHandler();
        }

        await attachListeners();

        updateTranscript('');
        updateInterimText('');
        updateStatus('listening');

        await executeStartNative();
    };

    const pauseListening = async () => {
        updateStatus('paused'); // Set status agar lockInterimAndRestart tahu kita sengaja stop
        try {
            await SpeechRecognition.stop();
        } catch (error) {
            console.error('Failed to pause recording', error);
        } finally {
            if (interimTextRef.current.trim() !== '') {
                const combined = joinText(transcriptRef.current, interimTextRef.current);
                updateTranscript(combined);
                updateInterimText('');
            }
        }
    };

    const stopListening = async () => {
        updateStatus('idle'); // Set idle agar auto-restart berhenti
        try {
            await SpeechRecognition.stop();
        } catch (error) {
            console.error('Failed to stop recording', error);
        } finally {
            if (interimTextRef.current.trim() !== '') {
                const combined = joinText(transcriptRef.current, interimTextRef.current);
                updateTranscript(combined);
                updateInterimText('');
            }
        }
    };

    const continueListening = async () => {
        updateStatus('listening');
        await executeStartNative();
    };

    // Auto-scroll yang smooth ke bawah
    useEffect(() => {
        ionContentRef.current?.scrollToBottom(300);
    }, [transcript, interimText]);

    const fullText = joinText(transcript, interimText);
    const statusLabel = status === 'listening' ? 'Listening' : status === 'paused' ? 'Paused' : 'Ready';

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

    const selectLanguageHandler = async () => {
        await selectLanguageRef.current?.open();
    }

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

                    updateTranscript(json);
                } catch (error) {
                    console.error("Gagal melakukan parse JSON:", error);
                }
            } else {
                console.log("contentData is empty/falsy, setting empty elements array");
                updateTranscript('');
            }
        }

        loadContentData();
    }, [selectedPage]);

    const saveTextToDatabase = async (textToSave: string) => {
        if (!selectedNote || !selectedPage || !textToSave.trim()) return;

        const bufferData = Buffer.from(JSON.stringify(textToSave), 'utf-8');
        console.log('Saving to database', selectedPage.id);

        try {
            const updatedPage = await NotesRepository.updatePage(selectedPage.id as number, { contentData: bufferData });
            console.log('Page saved successfully', updatedPage);

            // Functional Update untuk mengganti object di array tanpa re-render yang tidak perlu
            setPages((prevPages) =>
                prevPages.map(p =>
                    p.id === selectedPage.id ? { ...p, contentData: bufferData } : p
                )
            );
        } catch (error) {
            console.error('Error saving page:', error);
        }
    };

    return (
        <IonPage>
            <IonHeader className="ion-no-border relative">
                <IonToolbar>
                    <IonButtons slot="start" className="ion-padding-start">
                        <IonBackButton defaultHref="/" />
                    </IonButtons>

                    <IonTitle className='text-base ion-padding-start ion-padding-end line-clamp-1'>
                        Kimia Jaya Analisis Teknik Dasar Terapan Dr. Fitri
                    </IonTitle>

                    {isSupported && (
                        <div slot="end" className="ion-padding-end">
                            {status === 'listening' && (
                                <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse"></span>
                                    <IonText color="success" className="text-xs">{statusLabel}</IonText>
                                </div>
                            )}

                            {status === 'idle' && (
                                <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-blue-400"></span>
                                    <IonText color="medium" className="text-xs">{statusLabel}</IonText>
                                </div>
                            )}

                            {status === 'paused' && (
                                <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-red-400"></span>
                                    <IonText color="medium" className="text-xs">{statusLabel}</IonText>
                                </div>
                            )}
                        </div>
                    )}
                </IonToolbar>

                {isSupported && (
                    <div className='flex items-center justify-center gap-2 border-t border-neutral-200 pt-2'>
                        <IonIcon icon={languageOutline} />
                        <IonText className='text-sm'>
                            in <span className="text-red-700" onClick={selectLanguageHandler}>{language.name}</span>
                        </IonText>
                    </div>
                )}
            </IonHeader>

            <IonContent ref={ionContentRef} className="relative">
                {isSupported === false && (
                    <div className="ion-text-center ion-padding h-full flex items-center">
                        <div className="block text-center w-3/4 mx-auto">
                            <IonIcon icon={warningOutline} color="danger" style={{ fontSize: 42 }} />
                            <p>
                                <IonText color="danger">
                                    This device doesn't support speech recognition.
                                </IonText>
                            </p>
                        </div>
                    </div>
                )}

                {isSupported && (
                    <div className="block ion-padding min-h-full">
                        {fullText ? (
                            <IonText color="medium">
                                <div className="text-xl leading-7 text-neutral-800 whitespace-pre-wrap">
                                    {fullText}
                                </div>
                            </IonText>
                        ) : (
                            <div className="h-full flex items-center justify-center pt-20 mx-auto w-3/4">
                                <IonText color="medium">
                                    <div className="text-xl leading-7 text-neutral-800 text-center">
                                        Click the microphone button to start listening.
                                    </div>
                                </IonText>
                            </div>
                        )}
                    </div>
                )}

                <IonToast
                    isOpen={!!toastMessage}
                    message={toastMessage ?? ''}
                    duration={3000}
                    onDidDismiss={() => setToastMessage(null)}
                />
            </IonContent>

            {isSupported && (
                <IonFooter className="w-full py-2">
                    <div style={{ paddingBottom: 'var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0))' }}>
                        <div className='overflow-hidden pb-3'>
                            <div ref={pagesSwiperElRef} className='swiper !px-3'>
                                <div id="pages-list" className='swiper-wrapper flex flex-row pb-1'>
                                    {pages.map((page) => (
                                        <div key={page.id} className='swiper-slide !h-auto !w-auto flex-none'>
                                            <IonButton
                                                size='small'
                                                shape="round"
                                                mode='ios'
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

                        <div className='flex items-center justify-between px-3'>
                            <div className='w-10'>
                                <IonButton
                                    size='small'
                                    shape="round"
                                    color={'light'}
                                    onClick={() => selectLanguageHandler()}
                                >
                                    <IonIcon icon={languageOutline} slot='icon-only'></IonIcon>
                                </IonButton>
                            </div>

                            <div className='flex-1'>
                                <div className="flex justify-center gap-4">
                                    <div className="flex items-center">
                                        <IonButton
                                            shape="round"
                                            color={'danger'}
                                            onClick={stopListening}
                                            disabled={status === 'idle'}
                                        >
                                            <IonIcon icon={stopOutline} slot="icon-only"></IonIcon>
                                        </IonButton>
                                    </div>

                                    <div className="flex items-center">
                                        <IonButton
                                            shape="round"
                                            size="large"
                                            color={'success'}
                                            onClick={status === 'paused' ? continueListening : startListening}
                                            disabled={isSupported !== true || (status !== 'idle' && status !== 'paused')}
                                        >
                                            <IonIcon icon={micOutline} slot="icon-only"></IonIcon>
                                        </IonButton>
                                    </div>

                                    <div className="flex items-center">
                                        <IonButton
                                            shape="round"
                                            color={'warning'}
                                            onClick={pauseListening}
                                            disabled={status !== 'listening'}
                                        >
                                            <IonIcon icon={pauseOutline} slot="icon-only"></IonIcon>
                                        </IonButton>
                                    </div>
                                </div>
                            </div>

                            <div className='w-10'>
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
                        </div>
                    </div>
                </IonFooter>
            )}

            {/* remove page alert */}
            <IonAlert
                isOpen={showRemoveAlert}
                onDidDismiss={() => setShowRemoveAlert(false)}
                header='Are you sure to remove this listening?'
                message={'All your current notes on this listening will be permanently deleted.'}
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

            <IonSelect
                ref={selectLanguageRef}
                onIonChange={(event: any) => {
                    const value = event.detail.value;
                    if (value) {
                        // Cast the value to the exact keys of the by639_1 object
                        const langCode = value as keyof typeof by639_1;
                        const langName = by639_1[langCode].name;
                        setLanguage({ code: value, name: langName });
                    }
                }}
                value={language.code}
                className='hidden'
                interface="action-sheet"
            >
                {[...codes]
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((language) => (
                        <IonSelectOption
                            key={language.iso639_1}
                            value={language.iso639_1}
                        >
                            {language.name}
                        </IonSelectOption>
                    ))}
            </IonSelect>
        </IonPage>
    );
};

export default VoiceRecorderPage;