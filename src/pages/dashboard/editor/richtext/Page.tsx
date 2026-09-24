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
    useIonViewWillEnter,
    useIonViewWillLeave,
} from '@ionic/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type Quill from 'quill';
import { Delta, EmitterSource } from 'quill';
import QuillEditor, { type ImageUploadHandler } from '../../../../components/richtext/QuillEditor';
import { checkmarkCircleOutline, copyOutline, duplicateOutline, trashOutline } from 'ionicons/icons';
import { Note, Page } from '../../../../databases/entities/notes';
import Swiper from 'swiper';
import { FreeMode, Mousewheel } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/free-mode';
import NotesRepository from '../../../../databases/datasources/NotesRepository';
import { useSearchParams } from 'react-router-dom';
import { NoteFormatTypes, NotePageTypes, useLazyGetNoteByIdQuery, useUpsertNoteMutation } from '../../../../services/notes';
import { useGetWorkspaceByIdQuery } from '../../../../services/workspace';
import { generateUUID } from '../../../../utils/generator';
import { getUser } from '../../../../utils/authState';
import { useGetLearningSessionByIdQuery } from '../../../../services/learning.session';

const AUTOSAVE_THROTTLE_MS = 1000;

/**
 * A delta is "empty" only if it has no text AND no embeds (images, formulas,
 * videos, etc). The previous implementation only looked at string inserts,
 * so a page containing nothing but an image was treated as empty and its
 * content was discarded (contentData: null) on every save.
 */
function isDeltaEmpty(delta: Delta | null | undefined): boolean {
    if (!delta || !Array.isArray(delta.ops) || delta.ops.length === 0) {
        return true;
    }

    return !delta.ops.some((op) => {
        if (typeof op.insert === 'string') {
            return op.insert.trim().length > 0;
        }
        // Non-string insert = an embed (image/video/formula/etc) — real content.
        return op.insert !== undefined && op.insert !== null;
    });
}

const RichTextEditorPage: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const workspaceId = searchParams.get('workspaceId');
    const noteId = searchParams.get('noteId');
    const sessionId = searchParams.get('sessionId');
    const pageId = searchParams.get('pageId');
    const isProcessed = Boolean(searchParams.get('clusteredDate'));

    const ionContentRef = useRef<HTMLIonContentElement>(null);
    const quillRef = useRef<Quill | null>(null);
    const autosaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const [isDirty, setIsDirty] = useState(false);
    const isDirtyRef = useRef(false);
    const [isSaving, setIsSaving] = useState(false);
    const [hasContent, setHasContent] = useState(false);
    const [pages, setPages] = useState<Page[]>([]);
    const [clearSignal, setClearSignal] = useState(0);
    const [showClearAlert, setShowClearAlert] = useState(false);
    const [showRemoveAlert, setShowRemoveAlert] = useState(false);
    const [presentToast] = useIonToast();

    const [selectedNote, setSelectedNote] = useState<Note | null>(null);
    const [selectedPage, setSelectedPage] = useState<Partial<Page> | null>(null);
    const [hasSignificantChange, setHasSignificantChange] = useState(false);

    const pagesSwiperElRef = useRef<HTMLDivElement>(null);
    const pagesSwiperRef = useRef<Swiper | null>(null);
    const prevPagesLengthRef = useRef(pages.length);
    const prevNoteIdRef = useRef<string | null>(searchParams.get('noteId'));
    const isPageActiveRef = useRef(true);

    // Tracks the JSON we last wrote to the DB for the active page, so a
    // no-op autosave (e.g. triggered right after loading content into the
    // canvas) can be skipped instead of writing an identical row again.
    const lastSavedDataRef = useRef<string | null>(null);

    // Throttle bookkeeping: kapan terakhir kali benar-benar save, dan
    // apakah ada save yang masih berjalan (mencegah dua write bertabrakan
    // untuk page yang sama saat user mengetik cepat).
    const lastPersistedAtRef = useRef(0);
    const isSavingRef = useRef(false);

    // Menyimpan backup data quilljs secara real-time
    const initialQuillDataRef = useRef<Delta | null>(null);
    const latestQuillStateRef = useRef<Quill | null>(null);
    const initialQuillLengthRef = useRef<number>(0);

    // Menyimpan halaman yang sedang aktif agar tidak menjadi null saat unmount
    const selectedPageRef = useRef<Partial<Page> | null>(null);
    const selectedNoteRef = useRef<Partial<Note> | null>(null);
    const selectedSessionRef = useRef<{ id: string } | null>(null);

    // Gunakan useRef untuk menyimpan state awal tanpa memicu re-render
    const initialDelta = useRef<any>(null);
    const initialLength = useRef<number>(0);

    // Sumber kebenaran baseline: delta terakhir yang KITA TAHU sama dengan
    // server. HANYA ditulis di contentLoader (saat load awal / page baru)
    // dan handleSaveChanges (setelah sync berhasil). Effect yang me-load
    // konten ke editor cuma BACA ini, gak pernah nulis — supaya gak sirkular
    // kayak sebelumnya.
    const serverBaselineRef = useRef<Record<string, { delta: Delta; length: number }>>({});

    const setServerBaseline = useCallback((pageId: string, delta: Delta, length: number) => {
        serverBaselineRef.current[pageId] = { delta, length };
    }, []);

    // RTK Query
    const [getNoteById] = useLazyGetNoteByIdQuery();
    const { data: workspaceData } = useGetWorkspaceByIdQuery(workspaceId ?? "", { skip: !workspaceId });
    const { data: sessionData } = useGetLearningSessionByIdQuery(sessionId ?? "", { skip: !sessionId });

    const updateIsDirty = useCallback((value: boolean) => {
        setIsDirty(value);
        isDirtyRef.current = value;
    }, []);

    const handleUpdateUrlWithNoteId = (newNoteId: string) => {
        prevNoteIdRef.current = newNoteId;
        const newParams = new URLSearchParams(searchParams);
        newParams.set('noteId', newNoteId);
        setSearchParams(newParams, { replace: true });
    };

    // Saves an explicit (page, delta) pair. Takes both as arguments rather
    // than reading them from refs/state at call time, so callers control
    // exactly what gets written where — this is what makes it safe to call
    // right before switching pages (see flushPendingSave / persistCurrentPage).
    const persistPageContent = useCallback(async (page: Partial<Page>, delta: Delta) => {
        isSavingRef.current = true;
        // Hanya update state UI jika halaman masih aktif
        if (isPageActiveRef.current) setIsSaving(true);
        try {
            const contentEmpty = isDeltaEmpty(delta);
            const json = contentEmpty ? null : JSON.stringify(delta);

            // Identical to the last thing we saved (typically a save
            // triggered right after a programmatic updateScene, not a real
            // edit) — skip the redundant DB write.
            if (json === lastSavedDataRef.current) return;
            lastSavedDataRef.current = json;

            const bufferData = json ? Buffer.from(json, 'utf-8') : null;
            const contentText = quillRef.current?.getText().trim() ?? '';
            const currentStatus = selectedNoteRef.current?.status;
            const isDraft = currentStatus === 'draft';

            await NotesRepository.microUpdatePage(page.id as string, {
                id: page.id,
                userId: page.userId,
                workspaceId: page.workspaceId,
                workspaceNoteId: page.workspaceNoteId,
                learningSessionId: page.learningSessionId,
                contentData: bufferData,
                contentText: contentText,

                // 1. Jika dari awal draft, paksa 'draft'. 
                // 2. Jika bukan draft (published), apakah perubahan signifikan mengubahnya jadi draft lagi? 
                // Jika tidak, ganti `(hasSignificantChange ? 'draft' : 'published')` menjadi `'published'` saja.
                status: isDraft
                    ? 'draft'
                    : (hasSignificantChange ? 'draft' : 'published'),

                // Sama seperti di atas, jika draft paksa ke 'pending'.
                processingStatus: isDraft
                    ? 'pending'
                    : (hasSignificantChange ? 'pending' : 'processed'),
            }, false);

            console.log('selected page id: ', page.id, ' is updated');

            // Cegah update state jika halaman sudah di-reset oleh useIonViewDidLeave
            if (isPageActiveRef.current) {
                const updatedPages = pages.map((p) => (p.id === page.id ? {
                    ...p,
                    contentData: bufferData,
                    contentText: contentText,
                    status: (isDraft ? 'draft' : (hasSignificantChange ? 'draft' : 'published')) as any,
                    processingStatus: (isDraft ? 'pending' : (hasSignificantChange ? 'pending' : 'processed')) as any,
                } : p));

                setPages(updatedPages);

                // collect the contents
                const contents = updatedPages.map((p) => p.contentText).join('\n');
                await NotesRepository.updateNote({
                    id: selectedNoteRef.current?.id,
                    content: contents,
                }, false);
            }
        } catch (err) {
            console.error('Failed to save document', err);
            // Cegah update state jika halaman sudah di-reset oleh useIonViewDidLeave
            if (isPageActiveRef.current) {
                presentToast({ message: 'Could not save your changes.', duration: 2500, color: 'danger' });
            }
        } finally {
            isSavingRef.current = false;
            // Cegah update state jika halaman sudah di-reset oleh useIonViewDidLeave
            if (isPageActiveRef.current) setIsSaving(false);
        }
    }, [presentToast, workspaceId, hasSignificantChange, selectedNoteRef, pages, selectedNote]);

    // Persists whatever is currently in the editor for the currently selected page.
    const persistCurrentPage = useCallback(async () => {
        // Ambil data dari Ref, bukan dari state yang mungkin sudah hilang
        const page = selectedPageRef.current;
        const note = selectedNoteRef.current;
        const quill = latestQuillStateRef.current;

        if (!quill || !page || !note || isProcessed) return;
        await persistPageContent(page, quill.getContents());

        // Set false agar tidak terpicu dua kali
        updateIsDirty(false);
    }, [isProcessed, persistPageContent, updateIsDirty]);

    // Cancels any pending debounced autosave and, if there are unsaved
    // changes, saves them immediately for the CURRENT page.
    //
    // This must be awaited before switching pages, adding a page, or leaving
    // the editor. Without it, a pending autosave (scheduled while page A was
    // active) can fire after page B's content has already been swapped into
    // the editor, saving page B's content under page A's id.
    const flushPendingSave = useCallback(() => {
        if (autosaveTimer.current) {
            clearTimeout(autosaveTimer.current);
            autosaveTimer.current = undefined;
        }

        if (!isDirtyRef.current) return Promise.resolve();

        lastPersistedAtRef.current = Date.now();

        return persistCurrentPage().catch((err) => {
            console.error("Background save failed:", err);
        });
    }, [isDirty, persistCurrentPage]);

    // ...
    // Listen to text change from quilljs
    // ...
    const handleTextChange = useCallback((
        delta: Delta,
        oldDelta: Delta,
        source: EmitterSource,
        quill: Quill
    ) => {
        if (source !== 'user') return;

        // Panggil fungsi eksternal
        const result = calculateQuillChange(
            initialQuillDataRef.current,
            quill.getContents(),

            initialQuillLengthRef.current,
            quill.getLength(),
            5 // Threshold 10%
        );

        // Update state jika nilainya berubah saja
        setHasSignificantChange((prev) => {
            if (prev !== result.isReachedLimit) return result.isReachedLimit;
            return prev;
        });

        updateIsDirty(true);
        latestQuillStateRef.current = quill;
        setHasContent(!isDeltaEmpty(quill.getContents()));

        if (autosaveTimer.current) {
            clearTimeout(autosaveTimer.current);
            autosaveTimer.current = undefined;
        }

        const elapsed = Date.now() - lastPersistedAtRef.current;

        if (elapsed >= AUTOSAVE_THROTTLE_MS && !isSavingRef.current) {
            // Leading edge — window sudah lewat & tidak ada save yang
            // sedang berjalan, simpan sekarang juga.
            lastPersistedAtRef.current = Date.now();
            void persistCurrentPage();
        } else {
            // Trailing edge — jadwalkan satu save untuk penutup window ini.
            const remaining = elapsed >= AUTOSAVE_THROTTLE_MS
                ? AUTOSAVE_THROTTLE_MS
                : AUTOSAVE_THROTTLE_MS - elapsed;

            autosaveTimer.current = setTimeout(() => {
                autosaveTimer.current = undefined;
                lastPersistedAtRef.current = Date.now();
                void persistCurrentPage();
            }, remaining);
        }
    }, [persistCurrentPage, updateIsDirty]);

    // Fungsi untuk merekam kondisi awal (di-wrap dengan useCallback)
    const setInitialState = useCallback((delta: Delta) => {
        initialQuillDataRef.current = delta;
    }, []);

    const setInitialLength = useCallback((length: number) => {
        initialQuillLengthRef.current = length;
    }, []);

    const handleEnter = useCallback((quill: Quill) => {
        ionContentRef.current?.scrollToBottom(0);
    }, []);

    // Ionic's router outlet keeps pages mounted in its history stack, so plain
    // unmount isn't a reliable "user is leaving" signal — flush explicitly.
    useIonViewWillEnter(() => {
        isPageActiveRef.current = true;
    });

    useIonViewWillLeave(() => {
        isPageActiveRef.current = false;
        flushPendingSave();
    });

    useIonViewDidEnter(() => {
        window.dispatchEvent(new Event('resize'));

        (async () => {
            if (!workspaceId) return;
            await contentLoader(workspaceId, noteId, pageId);
        })();
    }, [noteId, workspaceId, pageId]);

    useIonViewDidLeave(() => {
        setPages([]);
        setSelectedPage(null);
        setSelectedNote(null);
        prevNoteIdRef.current = null;
    });

    useEffect(() => () => {
        if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    }, []);

    useEffect(() => {
        selectedPageRef.current = selectedPage;
    }, [selectedPage]);

    useEffect(() => {
        selectedNoteRef.current = selectedNote;
    }, [selectedNote]);

    useEffect(() => {
        selectedSessionRef.current = { id: sessionId ?? '' };
    }, [sessionId]);

    // Initialize the pages Swiper once and clean it up on unmount.
    useEffect(() => {
        const containerEl = pagesSwiperElRef.current;
        if (!containerEl) return;

        pagesSwiperRef.current = new Swiper(containerEl, {
            modules: [FreeMode, Mousewheel],
            direction: 'horizontal',
            slidesPerView: 'auto',
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
        });

        return () => {
            pagesSwiperRef.current?.destroy(true, true);
            pagesSwiperRef.current = null;
        };
    }, []);

    // Update/scroll the swiper whenever the page list changes.
    useEffect(() => {
        const swiper = pagesSwiperRef.current;
        if (!swiper) return;

        const isNewPageAdded = pages.length > prevPagesLengthRef.current;
        prevPagesLengthRef.current = pages.length;

        const raf = requestAnimationFrame(() => {
            swiper.update();
            if (isNewPageAdded) {
                swiper.slideTo(pages.length - 1, 300);
            }
        });

        return () => cancelAnimationFrame(raf);
    }, [pages]);

    // Load content data for the active page into the editor.
    useEffect(() => {
        if (!selectedPage?.id) return;
        const pageId = selectedPage.id;

        const loadContentData = async () => {
            const contentData = selectedPage?.contentData;
            lastPersistedAtRef.current = 0;

            let loadedDelta: Delta;
            let loadedLength: number;

            if (contentData) {
                const decoder = new TextDecoder('utf-8');
                const jsonString = decoder.decode(contentData);
                if (!jsonString) return;

                loadedDelta = new Delta(JSON.parse(jsonString));
                if (quillRef.current) quillRef.current.setContents(loadedDelta);
                loadedLength = quillRef.current?.getLength() ?? 0;

                setHasContent(true);
                lastSavedDataRef.current = jsonString;
            } else {
                loadedDelta = new Delta();
                loadedLength = 1;
                setHasContent(false);
                lastSavedDataRef.current = null;
                setTimeout(() => {
                    if (quillRef.current) quillRef.current.setContents(new Delta());
                }, 100);
            }

            // BACA saja. Fallback di sini cuma jaga-jaga kalau ada bug di
            // contentLoader yang bikin baseline belum ke-set — jalur normal
            // seharusnya selalu ketemu.
            const baseline = serverBaselineRef.current[pageId] ?? { delta: loadedDelta, length: loadedLength };
            setInitialState(baseline.delta);
            setInitialLength(baseline.length);

            // Dihitung ULANG tiap revisit, dari baseline yang gak pernah
            // bergeser — bukan di-reset ke false.
            const result = calculateQuillChange(baseline.delta, loadedDelta, baseline.length, loadedLength, 5);
            setHasSignificantChange(result.isReachedLimit);
        };

        loadContentData();
    }, [selectedPage, quillRef]);

    // select page
    const selectPageHandler = async (page: Page) => {
        if (!selectedNoteRef.current?.id || !selectedPageRef.current?.id) return;
        if (selectedPageRef.current?.id === page.id) return;

        try {
            // Flush any unsaved edits on the OUTGOING page before touching
            // selectedPage / swapping the editor's content.
            // if (!isProcessed) await flushPendingSave();

            const updatedPages = pages.map((p) => ({ ...p, isActive: p.id === page.id }));
            if (!isProcessed) {
                await NotesRepository.updatePagesBulk(updatedPages, false);
            }

            const currentPages = await NotesRepository.getPagesByNoteId(selectedNoteRef.current.id);
            if (isProcessed) {
                // fake isActive indicator
                setPages(prev => {
                    return prev.map((p) => ({ ...p, isActive: p.id === page.id }));
                });
            } else {
                setPages(currentPages);
            }

            const freshSelectedPage = currentPages.find((p) => p.id === page.id);
            if (freshSelectedPage) {
                setSelectedPage(freshSelectedPage);
            }
        } catch (err) {
            console.error('Failed to switch page', err);
            presentToast({ message: 'Could not switch pages.', duration: 2500, color: 'danger' });
        }
    };

    // add new page
    const newPageHandler = async () => {
        if (!selectedNoteRef.current?.id) return;

        try {
            // await flushPendingSave();

            const prevPages = pages.map((p: Page) => ({ ...p, isActive: false }));
            if (prevPages.length > 0) {
                await NotesRepository.updatePagesBulk(prevPages, false);
            }

            await createPage(selectedNoteRef.current, {
                id: generateUUID(),
                pageNum: pages.length + 1,
                workspaceId: selectedNoteRef.current.workspaceId,
                workspaceNoteId: selectedNoteRef.current.id,
                isActive: true,
                status: 'draft',
                processingStatus: 'pending',
                createdAt: new Date().toISOString(),
                // syncedAt: new Date().toISOString(),
                // syncedId: generateUUID(),
                learningSessionId: selectedSessionRef.current?.id ?? '',
            }, false);

            const updatedPages = await NotesRepository.getPagesByNoteId(selectedNoteRef.current.id);
            setPages(updatedPages);

            const activePage = updatedPages.find((p) => p.isActive);
            if (activePage) {
                setSelectedPage(activePage);
            }
        } catch (err) {
            console.error('Failed to create a new page', err);
            presentToast({ message: 'Could not create a new page.', duration: 2500, color: 'danger' });
        }
    };

    // --- CRUD NOTES ---
    const initNote = async (workspaceId: string, sessionId: string | null = null) => {
        const user = await getUser();
        const entity = await NotesRepository.insertNote({
            workspaceId: workspaceId,
            userId: user?.id ?? '',
            title: "Untitled Note",
            content: "",
            noteDatetime: sessionData?.ended_at ? new Date(sessionData?.ended_at).toISOString() : new Date().toISOString(),
            createdAt: sessionData?.created_at ? new Date(sessionData?.created_at).toISOString() : new Date().toISOString(),
            contentType: "text",
            // syncedId: generateUUID(),
            // syncedAt: new Date().toISOString(),
            status: 'draft',
            processingStatus: 'pending',
            learningSessionId: sessionId ? sessionId : '',
        }, false);
        return entity;
    }

    const createPage = async (note: Partial<Note>, data: Partial<Page>, syncToServer: boolean = true): Promise<Page> => {
        const user = await getUser();
        const entity = await NotesRepository.addPage(
            { id: note.id },
            { ...data, userId: user.id ?? '' },
            syncToServer
        );
        setServerBaseline(entity.id, new Delta(), 1);
        return entity;
    }
    // --- END CRUD NOTES ---

    // Load / create the note and its pages.
    const contentLoader = async (workspaceId: string, noteId: string | null = null, pageId: string | null = null) => {
        let note: any | null = null;

        if (noteId) {
            // 1. load dari local database dulu
            note = await NotesRepository.getNoteById(noteId);
            if (note) {
                console.log('load note from local database', note);

                // tapi butuh data asli dari server untuk membandingkan perubahan
                const { data: serverNote, error } = await getNoteById({ id: noteId });
                console.log('note dari local: load note from server', serverNote);

                // set baseline
                // Isi baseline utk page yang BELUM punya entry (belum pernah kesentuh
                // sesi ini). Kalau sudah ada, JANGAN ditimpa — itu prinsip utamanya.
                serverNote?.pages?.forEach((p: NotePageTypes) => {
                    if (serverBaselineRef.current[p.id]) return;

                    if (p.content_data) {
                        try {
                            const decoder = new TextDecoder('utf-8');
                            const x = Buffer.from(JSON.stringify(p.content_data));
                            const delta = new Delta(JSON.parse(decoder.decode(x)));
                            setServerBaseline(p.id, delta, delta.length());
                        } catch (err) {
                            console.error('Failed to set baseline for page', p.id, err);
                            setServerBaseline(p.id, new Delta(), 1);
                        }
                    } else {
                        setServerBaseline(p.id, new Delta(), 1);
                    }
                });
            } else {
                // 2. note tidak ada di local, load dari server
                const { data: serverNote } = await getNoteById({ id: noteId });
                console.log('load note from server', serverNote);

                // 3. karena dari server, inject ke local db
                if (serverNote) {
                    const newSyncedId = generateUUID();
                    const nData = {
                        id: serverNote.id,
                        workspaceId: workspaceId,
                        title: serverNote.title || "Untitled Note",
                        content: serverNote.content,
                        status: serverNote.status,
                        processingStatus: serverNote.processing_status,
                        noteDatetime: serverNote.note_datetime ? new Date(serverNote.note_datetime).toISOString() : new Date().toISOString(),
                        contentType: serverNote.content_type as NoteFormatTypes,
                        syncedId: serverNote.synced_id ? serverNote.synced_id : newSyncedId,
                        syncedAt: serverNote.synced_at ? new Date(serverNote.synced_at).toISOString() : new Date().toISOString(),
                        createdAt: serverNote.created_at ? new Date(serverNote.created_at).toISOString() : new Date().toISOString(),
                        learningSessionId: sessionId ? sessionId : '',
                    }

                    note = await NotesRepository.insertNote(nData, false);
                    console.log('injected note', note);

                    // di server belum punya synced_id -> update server
                    // if (!serverNote.synced_id) {
                    //     console.log('adding synced id to existing note');
                    //     await upsertNote({
                    //         body: {
                    //             id: serverNote.id,
                    //             synced_id: newSyncedId,
                    //             synced_at: new Date().toISOString(),
                    //         }
                    //     });
                    // }

                    // 4. lanjut insert pages nya jika ada
                    const injectedPages = serverNote.pages
                        ? serverNote.pages
                            .slice()
                            .sort((a: NotePageTypes, b: NotePageTypes) => a.page_num - b.page_num)
                            .map((p: NotePageTypes) => {
                                return {
                                    id: p.id,
                                    workspaceId: p.workspace_id,
                                    workspaceNoteId: p.workspace_note_id,
                                    contentText: p.content_text,
                                    contentData: p.content_data ? Buffer.from(JSON.stringify(p.content_data), 'utf-8') : null,
                                    userId: p.user_id,
                                    pageNum: p.page_num,
                                    status: p.status,
                                    processingStatus: p.processing_status,
                                    isActive: p.is_active,
                                    syncedId: p.synced_id ? p.synced_id : generateUUID(),
                                    syncedAt: p.synced_at ? new Date(p.synced_at).toISOString() : new Date().toISOString(),
                                    createdAt: p.created_at ? new Date(p.created_at).toISOString() : new Date().toISOString(),
                                    note: { id: serverNote.id },
                                    attributes: p.attributes,
                                    learningSessionId: sessionId ? sessionId : '',
                                }
                            })
                        : [];

                    if (injectedPages.length > 0) {
                        const savedPages = await NotesRepository.addPagesBulk(injectedPages, false);
                        console.log("injected pages", savedPages);
                    } else {
                        // halaman belum ada, buat halaman baru
                        // di local db dan server juga
                        const page = await createPage({ id: note.id }, {
                            id: generateUUID(),
                            pageNum: 1,
                            workspaceId: workspaceId,
                            workspaceNoteId: note.id,
                            isActive: true,
                            status: 'draft',
                            processingStatus: 'pending',
                            // syncedAt: new Date().toISOString(),
                            // syncedId: generateUUID(),
                            createdAt: new Date().toISOString(),
                            learningSessionId: sessionId ? sessionId : '',
                        }, false);

                        console.log('note first page injected', page);
                    }
                }
            }
        } else {
            // 0. cek apakah ada unsynced note
            // ini note dari local database
            const unsyncedNote = await NotesRepository.getUnsyncedNote('text');
            if (unsyncedNote) {
                note = unsyncedNote;
            }

            console.log('load unsynced note', unsyncedNote);
        }

        // 4. setelah dari local db dan server masih juga tidak ada
        // 5. buat note baru
        if (note === null) {
            // Brand-new note: there was never a server record to fetch.
            note = await initNote(workspaceId, sessionId);
            console.log('create new note', note);

            const page = await createPage({ id: note.id }, {
                id: generateUUID(),
                pageNum: 1,
                workspaceId: workspaceId,
                workspaceNoteId: note.id,
                isActive: true,
                status: 'draft',
                processingStatus: 'pending',
                // syncedAt: new Date().toISOString(),
                // syncedId: generateUUID(),
                createdAt: new Date().toISOString(),
                learningSessionId: sessionId ? sessionId : '',
            }, false);

            console.log('create page note didn\'t exist', page);
        }

        // setelah semuanya diatas beres
        if (note) {
            // set active note
            setSelectedNote(note);
            console.log('active note', note);

            // get all pages
            let savedPages = await NotesRepository.getPagesByNoteId(note.id);
            console.log('getting pages', savedPages);

            if (pageId) {
                savedPages = savedPages.map((p: Page) => ({
                    ...p,
                    isActive: p.id === pageId,
                }));
            }

            setPages(savedPages);

            // Isi baseline utk page yang BELUM punya entry (belum pernah kesentuh
            // sesi ini). Kalau sudah ada, JANGAN ditimpa — itu prinsip utamanya.
            savedPages.forEach((p: Page) => {
                if (serverBaselineRef.current[p.id]) return;

                if (p.contentData) {
                    try {
                        const decoder = new TextDecoder('utf-8');
                        const delta = new Delta(JSON.parse(decoder.decode(p.contentData)));
                        setServerBaseline(p.id, delta, delta.length());
                    } catch (e) {
                        console.error('Failed to set baseline for page', p.id, e);
                        setServerBaseline(p.id, new Delta(), 1);
                    }
                } else {
                    setServerBaseline(p.id, new Delta(), 1);
                }
            });

            // get active page
            const activePage = savedPages.find((p: Page) => p.isActive === true);
            if (activePage) {
                setSelectedPage(activePage);
                console.log('active page', activePage);
            }
        }
    }

    // Reset state & editor saat berpindah antar note (mengatasi isu cache/stale data)
    useEffect(() => {
        // 1. SELAMATKAN DATA SEBELUMNYA!
        // Jika kanvas masih kotor (belum disave), paksa save sekarang
        // ke background menggunakan data note yang lama (dari Ref).
        if (isDirtyRef.current) {
            console.log("Menyimpan note lama sebelum berpindah ke note baru...");
            flushPendingSave();
        }

        if (prevNoteIdRef.current !== noteId) {
            setPages([]);
            setSelectedPage(null);
            setSelectedNote(null);
            lastSavedDataRef.current = null;
            prevNoteIdRef.current = noteId;

            if (quillRef.current) {
                quillRef.current.setContents(new Delta());
            }
        }
    }, [noteId]);

    // ...
    // save changes
    // ...
    const handleSaveChanges = async () => {
        if (!selectedNoteRef?.current?.id) return;
        const user = await getUser();

        // update note dari 'draft' ke 'publish'
        // tujuannya untuk start embedding
        const newContent = pages.map((p) => p.contentText).join('\n');
        const res = await NotesRepository.upsertNote({
            id: selectedNoteRef.current.id || generateUUID(),
            userId: user.id,
            status: 'published',
            processingStatus: 'pending',
            contentType: 'text',
            noteDatetime: sessionData?.ended_at ? new Date(sessionData?.ended_at).toISOString() : new Date().toISOString(),
            createdAt: sessionData?.created_at ? new Date(sessionData?.created_at).toISOString() : new Date().toISOString(),
            content: newContent,
            syncedId: selectedNoteRef.current.syncedId || generateUUID(),
            syncedAt: new Date().toISOString(),
            learningSessionId: selectedNoteRef.current.learningSessionId,
            workspaceId: selectedNoteRef.current.workspaceId,
        }, ['id'], true);

        if (res) {
            const updatedPages = pages.map(p => ({
                ...p,
                workspaceId: res.workspaceId,
                status: 'published' as any,
                syncedId: p.syncedId || generateUUID(),
                syncedAt: new Date().toISOString(),
                createdAt: new Date().toISOString(),
            }));

            await NotesRepository.upsertPagesBulk(updatedPages);
            setPages(updatedPages);
            setSelectedNote(res);

            const activePageId = selectedPageRef.current?.id;

            updatedPages.forEach((p) => {
                if (p.id === activePageId && quillRef.current) {
                    // Halaman aktif: isi quill sekarang PERSIS yang baru dikirim
                    // ke server — paling akurat, gak perlu decode ulang.
                    setServerBaseline(p.id, quillRef.current.getContents(), quillRef.current.getLength());
                    return;
                }
                if (p.contentData) {
                    try {
                        const decoder = new TextDecoder('utf-8');
                        const delta = new Delta(JSON.parse(decoder.decode(p.contentData)));
                        setServerBaseline(p.id, delta, delta.length());
                    } catch (e) {
                        console.error('Failed to refresh baseline for page', p.id, e);
                    }
                } else {
                    setServerBaseline(p.id, new Delta(), 1);
                }
            });

            if (activePageId) {
                const b = serverBaselineRef.current[activePageId];
                setInitialState(b?.delta ?? new Delta());
                setInitialLength(b?.length ?? 1);
            }

            setHasSignificantChange(false);
            presentToast('Note saved successfully!', 1000);
        }

        // di url params tidak ada noteId
        // set dengan yang baru
        if (!noteId && res) {
            handleUpdateUrlWithNoteId(res.id);
        }
    }

    // 1. Simpan "Fingerprint" / State Awal saat editor siap
    useEffect(() => {
        if (quillRef.current) {
            // Simpan format Delta asli sebagai baseline
            initialDelta.current = quillRef.current.getContents();

            // Simpan panjang karakter awal (Quill minimal selalu punya 1 karakter: '\n')
            initialLength.current = quillRef.current.getLength();
        }
    }, [handleTextChange]); // Re-run jika initialHTML dari server berubah

    function calculateQuillChange(
        initialDelta: any,
        currentDelta: any,
        initialLength: number,
        currentLength: number, // Parameter baru
        threshold: number = 10
    ) {
        if (!initialDelta || !currentDelta) {
            return { percentage: 0, isReachedLimit: false };
        }

        const diff = initialDelta.diff(currentDelta);
        let totalChangedCharacters = 0;

        if (diff && diff.ops) {
            diff.ops.forEach((op: any) => {
                if (op.insert) {
                    totalChangedCharacters += typeof op.insert === 'string' ? op.insert.length : 1;
                }
                if (op.delete) {
                    totalChangedCharacters += op.delete;
                }
            });
        }

        // Gunakan teks terpanjang (awal atau sekarang) sebagai pembagi
        const maxLength = Math.max(initialLength, currentLength);
        const baseLength = maxLength <= 1 ? 1 : maxLength;

        // Hitung persentase dan kunci maksimal di 100%
        let percentage = (totalChangedCharacters / baseLength) * 100;
        percentage = Math.min(percentage, 100);

        return {
            percentage,
            isReachedLimit: percentage >= threshold
        };
    }

    return (
        <IonPage>
            <IonHeader className="ion-no-border">
                <IonToolbar color={'light'} className='borderless'>
                    <IonButtons slot="start" className="ion-padding-start">
                        <IonBackButton defaultHref="/dashboard" />
                    </IonButtons>

                    <IonTitle className='text-sm ion-padding-start ion-padding-end line-clamp-1'>
                        {workspaceData?.title ?? 'Untitled Note'}
                    </IonTitle>

                    {!isProcessed && (
                        <>
                            {pages.some(p => p.status === 'draft') && (
                                <IonButtons slot="end" className="ion-padding-end">
                                    <IonButton
                                        fill="solid"
                                        color="dark"
                                        size="small"
                                        mode="ios"
                                        shape="round"
                                        className="normal-button"
                                        style={{ '--padding-top': '6px', '--padding-bottom': '6px' }}
                                        onClick={handleSaveChanges}
                                        disabled={!pages.some(p => p.status === 'draft')}
                                    >
                                        Save Changes
                                    </IonButton>
                                </IonButtons>
                            )}

                            {!pages.some(p => p.status === 'draft') && (
                                <div slot="end" className="text-sm ion-padding-end flex items-center gap-2">
                                    <IonIcon icon={checkmarkCircleOutline} color="success" className='text-lg'></IonIcon>
                                    <IonText color="success">All Saved</IonText>
                                </div>
                            )}
                        </>
                    )}
                </IonToolbar>
            </IonHeader>

            <IonContent ref={ionContentRef} className='relative'>
                <QuillEditor
                    ref={quillRef}
                    defaultValue={null}
                    placeholder="Tap here to start…"
                    onTextChange={handleTextChange}
                    clearSignal={clearSignal}
                    onEnter={handleEnter}
                    readOnly={isProcessed}
                    className="quill-editor-container"
                />
            </IonContent>

            <IonFooter className='ion-no-border'>
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

                        {!isProcessed && (
                            <div className='flex items-center gap-3 pb-1 pr-2'>
                                <IonButton
                                    size='small'
                                    shape="round"
                                    color={'light'}
                                    disabled={pages.length <= 1 || !selectedPage || isProcessed}
                                    onClick={() => setShowRemoveAlert(true)}
                                >
                                    <IonIcon icon={trashOutline} slot='icon-only'></IonIcon>
                                </IonButton>
                                <IonButton
                                    size='small'
                                    shape="round"
                                    color={'light'}
                                    disabled={!hasContent || isProcessed}
                                    onClick={() => setShowClearAlert(true)}
                                >
                                    <IonIcon icon={copyOutline} slot='icon-only'></IonIcon>
                                </IonButton>

                                <IonButton
                                    size='small'
                                    shape="round"
                                    color={'light'}
                                    disabled={isProcessed}
                                    onClick={async () => await newPageHandler()}
                                >
                                    <IonIcon icon={duplicateOutline} slot='icon-only'></IonIcon>
                                </IonButton>
                            </div>
                        )}
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
                            // Cancel any pending autosave for the OLD content —
                            // we're about to explicitly persist the cleared state.
                            if (autosaveTimer.current) {
                                clearTimeout(autosaveTimer.current);
                                autosaveTimer.current = undefined;
                            }

                            setClearSignal((c) => c + 1);
                            setHasContent(false);

                            // Persist explicitly instead of relying on the
                            // text-change event: the clear is a programmatic
                            // edit (source !== 'user'), which handleTextChange
                            // now intentionally ignores.
                            if (selectedPage) {
                                await persistPageContent(selectedPage, new Delta());
                                setIsDirty(false);
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
                            if (!selectedPage) return;
                            const activeIndex = pages.findIndex((p) => p.id === selectedPage.id);
                            if (activeIndex === -1) return;

                            // jika sudah ter-sync ke database hapus di server
                            const isSynced = pages[activeIndex].syncedId !== null;

                            // Don't let a pending autosave resurrect the page
                            // we're about to delete.
                            if (autosaveTimer.current) {
                                clearTimeout(autosaveTimer.current);
                                autosaveTimer.current = undefined;
                            }

                            try {
                                await NotesRepository.deletePage({
                                    pageId: pages[activeIndex].id,
                                    workspaceId: pages[activeIndex].workspaceId,
                                    workspaceNoteId: pages[activeIndex].workspaceNoteId,
                                    learningSessionId: pages[activeIndex].learningSessionId,
                                    syncToServer: isSynced ? true : false,
                                });

                                const remaining = pages.filter((_, idx) => idx !== activeIndex);

                                if (remaining.length === 0) {
                                    setPages([]);
                                    setSelectedPage(null);
                                    setIsDirty(false);
                                    setClearSignal((c) => c + 1);
                                    return;
                                }

                                // pilih page berikutnya kalau ada, atau page sebelumnya kalau yang dihapus adalah terakhir
                                const nextActiveIndex = Math.min(activeIndex, remaining.length - 1);

                                const reindexed = remaining.map((p, idx) => ({
                                    ...p,
                                    pageNum: idx + 1,
                                    isActive: idx === nextActiveIndex,
                                }));

                                await NotesRepository.updatePagesBulk(reindexed, isSynced ? true : false);
                                setPages(reindexed);
                                setIsDirty(false);

                                // Set directly from the data we already have —
                                // routing this through selectPageHandler here would
                                // read a stale `pages` closure (state hasn't
                                // re-rendered with `reindexed` yet) and write
                                // incomplete data back to the DB.
                                setSelectedPage(reindexed[nextActiveIndex]);
                            } catch (err) {
                                console.error('Failed to remove page', err);
                                presentToast({ message: 'Could not remove this page.', duration: 2500, color: 'danger' });
                            }
                        },
                    },
                ]}
            ></IonAlert>
        </IonPage>
    );
};

export default RichTextEditorPage;