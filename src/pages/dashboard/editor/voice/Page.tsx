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
    useIonViewWillLeave,
} from '@ionic/react';
import './Page.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import { duplicateOutline, languageOutline, micOutline, pauseOutline, stopOutline, trashOutline, warningOutline } from 'ionicons/icons';
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
import { useSearchParams } from 'react-router-dom';
import { NoteFormatTypes, NotePageTypes, NoteTypes, useGetNoteByIdQuery, useUpsertNoteMutation } from '../../../../services/notes';
import { useGetWorkspaceByIdQuery } from '../../../../services/workspace';
import { generateUUID } from '../../../../utils/generator';

const RECOGNITION_LANGUAGE = 'en';

type RecorderStatus = 'idle' | 'listening' | 'paused';

const VoiceRecorderPage: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const workspaceId = searchParams.get('workspaceId');
    const noteId = searchParams.get('noteId');

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

    // The native listeners below (see attachListeners) are attached ONCE and
    // are never re-created — guarded by `if (!ref.current)`. Anything they
    // close over would otherwise go stale forever: e.g. record on page 1 →
    // stop → switch to page 2 → record again would silently keep saving to
    // page 1, because the listener's closure still points at the old page.
    // selectedPageRef gets the same ref-mirroring treatment as
    // status/transcript/interim above so the listeners always see the page
    // that is ACTUALLY selected right now.
    const selectedPageRef = useRef<Partial<Page> | null>(null);

    const partialListenerRef = useRef<PluginListenerHandle | null>(null);
    const errorListenerRef = useRef<PluginListenerHandle | null>(null);
    const stateListenerRef = useRef<PluginListenerHandle | null>(null);

    const [showRemoveAlert, setShowRemoveAlert] = useState(false);
    const [pages, setPages] = useState<Page[]>([]);
    const [selectedNote, setSelectedNote] = useState<Note | null>(null);
    const [selectedPage, setSelectedPage] = useState<Partial<Page> | null>(null);
    const noteInitStarted = useRef(false);

    const pagesSwiperElRef = useRef<HTMLDivElement>(null);
    const pagesSwiperRef = useRef<Swiper | null>(null);
    const prevPagesLengthRef = useRef(pages.length);
    const selectLanguageRef = useRef<HTMLIonSelectElement>(null);

    // RTK Query — same note/workspace loading pattern as the rich-text editor page.
    const {
        data: noteData,
        isLoading: gettingNote,
        isError: gettingNoteError,
    } = useGetNoteByIdQuery({ id: noteId! }, { skip: !noteId });
    const [upsertNote] = useUpsertNoteMutation();
    const { data: workspaceData } = useGetWorkspaceByIdQuery(workspaceId ?? "", { skip: !workspaceId });

    const handleUpdateUrlWithNoteId = (newNoteId: string) => {
        const newParams = new URLSearchParams(searchParams);
        newParams.set('noteId', newNoteId);
        setSearchParams(newParams, { replace: true });
    };

    // Helper Functions untuk update state dan ref sekaligus secara aman
    const updateStatus = (newStatus: RecorderStatus) => {
        statusRef.current = newStatus;
        setStatus(newStatus);
    };

    const updateTranscript = (text: string) => {
        transcriptRef.current = text;
        setTranscript(text);
    };

    const updateInterimText = (text: string) => {
        interimTextRef.current = text;
        setInterimText(text);
    };

    useEffect(() => {
        selectedPageRef.current = selectedPage;
    }, [selectedPage]);

    // Persists the FULL current text for an explicit (page, text) pair.
    // Takes both as arguments instead of reading ambient state, so every
    // caller controls exactly what gets written where — mirrors
    // persistPageContent in the rich-text editor page.
    const persistPageContent = useCallback(async (page: Partial<Page>, fullText: string) => {
        try {
            const contentEmpty = fullText.trim().length === 0;
            const bufferData = contentEmpty ? null : Buffer.from(JSON.stringify(fullText), 'utf-8');

            await NotesRepository.updatePage(page.id as string, { contentData: bufferData });

            setPages((prevPages) =>
                prevPages.map((p) => (p.id === page.id ? { ...p, contentData: bufferData } : p))
            );
        } catch (err) {
            console.error('Failed to save transcript', err);
            setToastMessage('Could not save your changes.');
        }
    }, []);

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
                pagesSwiperRef.current = new Swiper(containerEl, {
                    modules: [FreeMode, Mousewheel],
                    direction: 'horizontal',
                    slidesPerView: 'auto',
                    centerInsufficientSlides: false,
                    spaceBetween: 8,
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
                    watchOverflow: true,
                    observer: true,
                    observeParents: true,
                    centeredSlides: false,
                    centeredSlidesBounds: false,
                });
            } else {
                pagesSwiperRef.current.update();

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
    });

    // Ionic keeps this page mounted in its router stack, so navigating away
    // doesn't unmount it — without this the mic would keep listening (and
    // saving) in the background after the user leaves.
    useIonViewWillLeave(() => {
        if (statusRef.current !== 'idle') {
            void stopListening();
        }
    });

    useIonViewDidLeave(() => {
        setPages([]);
        setSelectedPage(null);
        setSelectedNote(null);
        noteInitStarted.current = false;
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
            if (interimTextRef.current.trim() !== '') {
                const combined = joinText(transcriptRef.current, interimTextRef.current);
                updateTranscript(combined);
                updateInterimText('');

                const page = selectedPageRef.current;
                if (page) {
                    await persistPageContent(page, combined);
                }
            }

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
                    if (matchText.trim() !== '') {
                        updateInterimText(matchText);

                        // Save the FULL text so far (finalized transcript +
                        // this in-progress chunk), not just the chunk —
                        // otherwise every save overwrites the page with only
                        // the latest utterance and earlier speech is lost.
                        // Read the page from the ref (see comment above) so
                        // this always writes to whichever page is actually
                        // selected right now, not whichever was selected
                        // when this listener was first attached.
                        const page = selectedPageRef.current;
                        if (page) {
                            await persistPageContent(page, joinText(transcriptRef.current, matchText));
                        }
                    }
                }
            );
        }

        if (!errorListenerRef.current) {
            errorListenerRef.current = await SpeechRecognition.addListener(
                'error',
                (event: SpeechRecognitionErrorEvent) => {
                    console.warn('Native error/timeout:', event);
                    lockInterimAndRestart();
                }
            );
        }

        if (!stateListenerRef.current) {
            stateListenerRef.current = await SpeechRecognition.addListener(
                'listeningState',
                (event: SpeechRecognitionListeningEvent) => {
                    if (event.status === 'stopped') {
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
        updateStatus('paused');
        try {
            await SpeechRecognition.stop();
        } catch (error) {
            console.error('Failed to pause recording', error);
        } finally {
            let finalText = transcriptRef.current;
            if (interimTextRef.current.trim() !== '') {
                finalText = joinText(transcriptRef.current, interimTextRef.current);
                updateTranscript(finalText);
                updateInterimText('');
            }

            const page = selectedPageRef.current;
            if (page) {
                await persistPageContent(page, finalText);
            }
        }
    };

    const stopListening = async () => {
        updateStatus('idle');
        try {
            await SpeechRecognition.stop();
        } catch (error) {
            console.error('Failed to stop recording', error);
        } finally {
            let finalText = transcriptRef.current;
            if (interimTextRef.current.trim() !== '') {
                finalText = joinText(transcriptRef.current, interimTextRef.current);
                updateTranscript(finalText);
                updateInterimText('');
            }

            const page = selectedPageRef.current;
            if (page) {
                await persistPageContent(page, finalText);
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
        if (selectedPage?.id === page.id) return;

        // Recording is scoped to a single page (see attachListeners) — stop
        // it first so we don't keep writing new transcript text to the page
        // we're about to leave.
        if (statusRef.current !== 'idle') {
            await stopListening();
        }

        try {
            const updatedPages = pages.map((p) => ({ ...p, isActive: p.id === page.id }));
            await NotesRepository.updatePagesBulk(updatedPages);
            setPages(updatedPages);

            // getting page from database agar kita mendapatkan contentData yang TERBARU
            if (selectedNote) {
                const currentPages = await NotesRepository.getPagesByNoteId(selectedNote.id);
                setPages(currentPages);

                const freshSelectedPage = currentPages.find((p) => p.id === page.id);
                if (freshSelectedPage) {
                    setSelectedPage(freshSelectedPage);
                }
            }
        } catch (err) {
            console.error('Failed to switch page', err);
            setToastMessage('Could not switch pages.');
        }
    };

    // add new page
    const newPageHandler = async () => {
        if (!selectedNote) return;

        try {
            const prevPages = pages.map((p: Page) => ({ ...p, isActive: false }));
            await NotesRepository.updatePagesBulk(prevPages);

            await createPage(selectedNote, {
                pageNum: pages.length + 1,
                workspaceId: selectedNote.workspaceId,
                workspaceNoteId: selectedNote.id,
                isActive: true,
                syncedAt: new Date(),
                syncedId: generateUUID(),
            });

            // RE-FETCH dari database untuk memastikan kita mendapatkan ID yang benar
            const updatedPages = await NotesRepository.getPagesByNoteId(selectedNote.id);
            setPages(updatedPages);

            const activePage = updatedPages.find((p) => p.isActive);
            if (activePage) {
                setSelectedPage(activePage);
            }
        } catch (err) {
            console.error('Failed to create a new page', err);
            setToastMessage('Could not create a new page.');
        }
    };

    // --- CRUD NOTES ---
    const initNote = async (workspaceId: string) => {
        const entity = await NotesRepository.insertNote({
            workspaceId: workspaceId,
            title: "Untitled Note",
            content: "",
            noteDatetime: new Date(),
            contentType: "text",
            syncedId: generateUUID(),
            syncedAt: new Date(),
        });
        return entity;
    }

    const createPage = async (note: Partial<Note>, data: Partial<Page>): Promise<Page> => {
        const entity = await NotesRepository.addPage({ id: note.id }, data);
        return entity;
    }
    // --- END CRUD NOTES ---

    // Load / create the note and its pages.
    useEffect(() => {
        if (!workspaceId) return;

        // We only need to wait on the server fetch when there IS a noteId to
        // fetch. When noteId is absent, the query is skipped and isLoading
        // never resolves, so gating on it unconditionally made "create a
        // brand-new note" unreachable.
        if (noteId && gettingNote) return;

        let cancelled = false;

        (async () => {
            let note = noteId ? await NotesRepository.getNoteById(noteId) : null;
            if (note && !cancelled) {
                console.log('load note from database', note);
                setSelectedNote(note);
            }

            if (note === null && !noteInitStarted.current) {
                // Validasi: pastikan noteData yang ada di cache RTK Query adalah milik noteId saat ini
                if (noteData && (noteData as NoteTypes).id === noteId) {
                    noteInitStarted.current = true;
                    console.log("store server data to local db");
                    const nd = noteData as NoteTypes;
                    const newSyncedId = generateUUID();
                    const nData = {
                        id: nd.id,
                        workspaceId: workspaceId,
                        title: nd.title || "Untitled Note",
                        content: nd.content,
                        noteDatetime: nd.note_datetime ? new Date(nd.note_datetime) : new Date(),
                        contentType: nd.content_type as NoteFormatTypes,
                        syncedId: nd.synced_id ? nd.synced_id : newSyncedId,
                        syncedAt: nd.synced_at ? new Date(nd.synced_at) : new Date(),
                    }

                    note = await NotesRepository.insertNote(nData);
                    if (!cancelled) setSelectedNote(note);

                    if (!nd.synced_id) {
                        console.log('adding synced id to existing note');
                        await upsertNote({
                            body: {
                                id: nd.id,
                                synced_id: newSyncedId,
                                synced_at: new Date().toISOString(),
                                workspace_id: workspaceId,
                                content: nd.content ? nd.content : '',
                                content_type: nd.content_type as NoteFormatTypes,
                            }
                        }).unwrap();
                    }

                    const currentPages: Page[] = nd?.pages
                        ? nd.pages
                            .slice()
                            .sort((a: NotePageTypes, b: NotePageTypes) => a.page_num - b.page_num)
                            .map((p: NotePageTypes) => {
                                return {
                                    id: p.id,
                                    workspaceId: p.workspace_id,
                                    workspaceNoteId: p.workspace_note_id,
                                    contentData: p.content_data ? Buffer.from(JSON.stringify(p.content_data), 'utf-8') : null,
                                    userId: p.user_id,
                                    pageNum: p.page_num,
                                    isActive: p.is_active,
                                    syncedId: p.synced_id ? p.synced_id : generateUUID(),
                                    syncedAt: p.synced_at ? new Date(p.synced_at) : new Date(),
                                    note: { id: nd.id }
                                }
                            })
                        : [];

                    if (currentPages.length > 0) {
                        const savedPages = await NotesRepository.addPagesBulk({ id: nd.id }, currentPages);
                        console.log("savedPages", savedPages);
                    }
                    else {
                        const page = await createPage({ id: note.id }, {
                            pageNum: 1,
                            workspaceId: workspaceId,
                            workspaceNoteId: note.id,
                            isActive: true,
                            syncedAt: new Date(),
                            syncedId: generateUUID(),
                        });
                        if (!cancelled) setSelectedPage(page);
                        console.log('create page', page);
                    }
                }
                else if (!noteId) {
                    // Brand-new note: there was never a server record to fetch.
                    noteInitStarted.current = true;
                    note = await initNote(workspaceId);
                    if (!cancelled) setSelectedNote(note);
                    console.log('create new note', note);

                    // update url with note id
                    setTimeout(() => {
                        if (note && note.id) {
                            handleUpdateUrlWithNoteId(note.id);
                        }
                    }, 500);

                    const page = await createPage({ id: note.id }, {
                        pageNum: 1,
                        workspaceId: workspaceId,
                        workspaceNoteId: note.id,
                        isActive: true,
                        syncedAt: new Date(),
                        syncedId: generateUUID(),
                    });
                    if (!cancelled) setSelectedPage(page);
                    console.log('create page note didn\'t exist', page);
                }
                else if (gettingNoteError) {
                    setToastMessage('Could not load this note.');
                }
            }

            // get all pages
            if (note && !cancelled) {
                const currentPages = await NotesRepository.getPagesByNoteId(note.id);
                console.log('getting pages');
                setPages([...currentPages]);

                // get active page
                const activePage = currentPages.find((p: Page) => p.isActive === true);
                if (activePage) {
                    setSelectedPage(activePage);
                    console.log('active page', activePage);
                }
            }
        })();

        return () => {
            cancelled = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- upsertNote/setToastMessage are stable-ish;
        // including them risks re-running this effect (and re-creating a note) on unrelated identity changes.
    }, [workspaceId, noteId, noteData, gettingNote, gettingNoteError]);

    // Reset state & transcript saat berpindah antar note (mengatasi isu cache/stale data)
    useEffect(() => {
        setPages([]);
        setSelectedPage(null);
        setSelectedNote(null);
        noteInitStarted.current = false;
        updateTranscript('');
        updateInterimText('');
    }, [noteId]);

    const selectLanguageHandler = async () => {
        await selectLanguageRef.current?.open();
    }

    // load content data from database
    useEffect(() => {
        if (!selectedPage) return;

        const loadContentData = async () => {
            const contentData = selectedPage?.contentData;

            if (contentData) {
                try {
                    const decoder = new TextDecoder('utf-8');
                    const jsonString = decoder.decode(contentData);

                    if (!jsonString) return;

                    const json = JSON.parse(jsonString);
                    updateTranscript(json);
                } catch (error) {
                    console.error('Failed to parse saved content', error);
                }
            } else {
                updateTranscript('');
            }
        }

        loadContentData();
    }, [selectedPage]);

    return (
        <IonPage>
            <IonHeader className="ion-no-border relative">
                <IonToolbar>
                    <IonButtons slot="start" className="ion-padding-start">
                        <IonBackButton defaultHref="/" />
                    </IonButtons>

                    <IonTitle className='text-base ion-padding-start ion-padding-end line-clamp-1'>
                        {workspaceData?.title ?? 'Untitled Note'}
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
                        <div className='flex flex-row gap-2 items-center justify-between pb-3 px-1'>
                            <div className='flex-1 overflow-hidden'>
                                <div ref={pagesSwiperElRef} className='swiper !px-2'>
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

                            <div className='flex items-center pr-2'>
                                <IonButton size='small' shape="round" color={'light'} onClick={async () => await newPageHandler()}>
                                    <IonIcon icon={duplicateOutline} slot='icon-only'></IonIcon>
                                </IonButton>
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
                                    disabled={pages.length <= 1 || !selectedPage}
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
                header='Are you sure to remove this page?'
                message={'All your current notes on this page will be permanently deleted.'}
                buttons={[
                    { text: 'Cancel', role: 'cancel' },
                    {
                        text: 'Yes',
                        role: 'destructive',
                        handler: async () => {
                            if (!selectedPage) return;
                            const activeIndex = pages.findIndex((p) => p.id === selectedPage.id);
                            if (activeIndex === -1) return;

                            // Don't let a still-running recognizer resurrect
                            // the page we're about to delete.
                            if (statusRef.current !== 'idle') {
                                await stopListening();
                            }

                            try {
                                await NotesRepository.deletePage(pages[activeIndex].id, pages[activeIndex].syncedId);

                                const remaining = pages.filter((_, idx) => idx !== activeIndex);

                                if (remaining.length === 0) {
                                    setPages([]);
                                    setSelectedPage(null);
                                    updateTranscript('');
                                    updateInterimText('');
                                    return;
                                }

                                // pilih page berikutnya kalau ada, atau page sebelumnya kalau yang dihapus adalah terakhir
                                const nextActiveIndex = Math.min(activeIndex, remaining.length - 1);

                                const reindexed = remaining.map((p, idx) => ({
                                    ...p,
                                    pageNum: idx + 1,
                                    isActive: idx === nextActiveIndex,
                                }));

                                await NotesRepository.updatePagesBulk(reindexed);
                                setPages(reindexed);

                                // Set directly from the data we already have —
                                // routing this through selectPageHandler here would
                                // read a stale `pages` closure (state hasn't
                                // re-rendered with `reindexed` yet) and write
                                // incomplete data back to the DB.
                                setSelectedPage(reindexed[nextActiveIndex]);
                            } catch (err) {
                                console.error('Failed to remove page', err);
                                setToastMessage('Could not remove this page.');
                            }
                        },
                    },
                ]}
            ></IonAlert>

            <IonSelect
                ref={selectLanguageRef}
                onIonChange={(event: any) => {
                    const value = event.detail.value;
                    if (value) {
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