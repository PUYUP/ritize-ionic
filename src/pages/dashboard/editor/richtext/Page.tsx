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
import { copyOutline, duplicateOutline, trashOutline } from 'ionicons/icons';
import { Note, Page } from '../../../../databases/entities/notes';
import Swiper from 'swiper';
import { FreeMode, Mousewheel } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/free-mode';
import NotesRepository from '../../../../databases/datasources/NotesRepository';
import { useSearchParams } from 'react-router-dom';
import { NoteFormatTypes, NotePageTypes, NoteTypes, useGetNoteByIdQuery, useLazyGetNoteByIdQuery, useUpsertNoteMutation } from '../../../../services/notes';
import { useGetWorkspaceByIdQuery } from '../../../../services/workspace';
import { generateUUID } from '../../../../utils/generator';

const AUTOSAVE_DELAY_MS = 1500;

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
    const prevNoteIdRef = useRef<string | null>(searchParams.get('noteId'));

    // Tracks the JSON we last wrote to the DB for the active page, so a
    // no-op autosave (e.g. triggered right after loading content into the
    // canvas) can be skipped instead of writing an identical row again.
    const lastSavedDataRef = useRef<string | null>(null);

    // RTK Query
    const [getNoteById, { data: noteData, isLoading: gettingNote, isError: gettingNoteError }] = useLazyGetNoteByIdQuery();
    const [upsertNote] = useUpsertNoteMutation();
    const { data: workspaceData } = useGetWorkspaceByIdQuery(workspaceId ?? "", { skip: !workspaceId });

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
        setIsSaving(true);
        try {
            const contentEmpty = isDeltaEmpty(delta);
            const json = contentEmpty ? null : JSON.stringify(delta);

            // Identical to the last thing we saved (typically a save
            // triggered right after a programmatic updateScene, not a real
            // edit) — skip the redundant DB write.
            if (json === lastSavedDataRef.current) return;
            lastSavedDataRef.current = json;

            const bufferData = json ? Buffer.from(json, 'utf-8') : null;

            await NotesRepository.updatePage(page.id as string, { contentData: bufferData });
            console.log('selected page id: ', page.id, ' is updated');

            setPages((prevPages) =>
                prevPages.map((p) => (p.id === page.id ? { ...p, contentData: bufferData } : p))
            );
        } catch (err) {
            console.error('Failed to save document', err);
            presentToast({ message: 'Could not save your changes.', duration: 2500, color: 'danger' });
        } finally {
            setIsSaving(false);
        }
    }, [presentToast]);

    // Persists whatever is currently in the editor for the currently selected page.
    const persistCurrentPage = useCallback(async () => {
        const quill = quillRef.current;
        if (!quill || !selectedPage) return;
        await persistPageContent(selectedPage, quill.getContents());
        setIsDirty(false);
    }, [selectedPage, persistPageContent]);

    // Cancels any pending debounced autosave and, if there are unsaved
    // changes, saves them immediately for the CURRENT page.
    //
    // This must be awaited before switching pages, adding a page, or leaving
    // the editor. Without it, a pending autosave (scheduled while page A was
    // active) can fire after page B's content has already been swapped into
    // the editor, saving page B's content under page A's id.
    const flushPendingSave = useCallback(async () => {
        if (autosaveTimer.current) {
            clearTimeout(autosaveTimer.current);
            autosaveTimer.current = undefined;
        }
        if (!isDirty) return;
        await persistCurrentPage();
    }, [isDirty, persistCurrentPage]);

    const handleTextChange = useCallback((
        delta: Delta,
        oldDelta: Delta,
        source: EmitterSource,
        quill: Quill
    ) => {
        // Ignore programmatic changes — e.g. quill.setContents(...) fired by
        // the page-load effect below whenever `selectedPage` changes. Only
        // real user edits should mark the document dirty / trigger a save.
        if (source !== 'user') return;

        setIsDirty(true);
        // Base "has content" on the full document, not the incremental
        // delta diff — a diff of a deletion can have >1 ops and a diff of
        // an insertion can look "non-empty" while the document as a whole
        // is empty (or vice versa).
        setHasContent(!isDeltaEmpty(quill.getContents()));

        if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
        autosaveTimer.current = setTimeout(() => {
            void persistCurrentPage();
        }, AUTOSAVE_DELAY_MS);
    }, [persistCurrentPage]);

    const handleEnter = useCallback((quill: Quill) => {
        ionContentRef.current?.scrollToBottom(0);
    }, []);

    useIonViewWillEnter(() => {
        // pass
    });

    // Ionic's router outlet keeps pages mounted in its history stack, so plain
    // unmount isn't a reliable "user is leaving" signal — flush explicitly.
    useIonViewWillLeave(() => {
        void flushPendingSave();
    });

    useIonViewDidEnter(() => {
        window.dispatchEvent(new Event('resize'));

        (async () => {
            if (!workspaceId) return;
            await contentLoader(workspaceId, noteId);
        })();
    }, [noteId, workspaceId]);

    useIonViewDidLeave(() => {
        setPages([]);
        setSelectedPage(null);
        setSelectedNote(null);
        prevNoteIdRef.current = null;
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
        if (!selectedPage) return;

        const loadContentData = async () => {
            const contentData = selectedPage?.contentData;

            if (contentData) {
                try {
                    const decoder = new TextDecoder('utf-8');
                    const jsonString = decoder.decode(contentData);

                    if (!jsonString) return;

                    const json = JSON.parse(jsonString);

                    if (quillRef.current) {
                        quillRef.current.setContents(new Delta(json));
                    }

                    setHasContent(true);
                    // Seed the dedupe ref so the onChange this triggers
                    // doesn't cause an immediate, redundant re-save.
                    lastSavedDataRef.current = jsonString;
                } catch (error) {
                    console.error('Failed to parse saved content', error);
                }
            } else {
                setHasContent(false);
                lastSavedDataRef.current = null;

                setTimeout(() => {
                    if (quillRef.current) {
                        quillRef.current.setContents(new Delta());
                    }
                }, 100);
            }
        };

        loadContentData();
    }, [selectedPage]);

    // select page
    const selectPageHandler = async (page: Page) => {
        if (selectedPage?.id === page.id) return;

        try {
            // Flush any unsaved edits on the OUTGOING page before touching
            // selectedPage / swapping the editor's content.
            await flushPendingSave();

            const updatedPages = pages.map((p) => ({ ...p, isActive: p.id === page.id }));
            await NotesRepository.updatePagesBulk(updatedPages);
            setPages(updatedPages);

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
            presentToast({ message: 'Could not switch pages.', duration: 2500, color: 'danger' });
        }
    };

    // add new page
    const newPageHandler = async () => {
        if (!selectedNote) return;

        try {
            await flushPendingSave();

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

            const updatedPages = await NotesRepository.getPagesByNoteId(selectedNote.id);
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
    const contentLoader = async (workspaceId: string, noteId: string | null = null) => {
        let note: any | null = null;

        if (noteId) {
            // 1. load dari local database dulu
            note = await NotesRepository.getNoteById(noteId);
            if (note) {
                console.log('load note from local database', note);
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
                        noteDatetime: serverNote.note_datetime ? new Date(serverNote.note_datetime) : new Date(),
                        contentType: serverNote.content_type as NoteFormatTypes,
                        syncedId: serverNote.synced_id ? serverNote.synced_id : newSyncedId,
                        syncedAt: serverNote.synced_at ? new Date(serverNote.synced_at) : new Date(),
                    }

                    note = await NotesRepository.insertNote(nData);
                    console.log('injected note', note);

                    // di server belum punya synced_id -> update server
                    if (!serverNote.synced_id) {
                        console.log('adding synced id to existing note');
                        await upsertNote({
                            body: {
                                id: serverNote.id,
                                synced_id: newSyncedId,
                                synced_at: new Date().toISOString(),
                            }
                        }).unwrap();
                    }

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
                                    contentData: p.content_data ? Buffer.from(JSON.stringify(p.content_data), 'utf-8') : null,
                                    userId: p.user_id,
                                    pageNum: p.page_num,
                                    isActive: p.is_active,
                                    syncedId: p.synced_id ? p.synced_id : generateUUID(),
                                    syncedAt: p.synced_at ? new Date(p.synced_at) : new Date(),
                                    note: { id: serverNote.id }
                                }
                            })
                        : [];

                    if (injectedPages.length > 0) {
                        const savedPages = await NotesRepository.addPagesBulk({ id: serverNote.id }, injectedPages);
                        console.log("injected pages", savedPages);
                    } else {
                        // halaman belum ada, buat halaman baru
                        // di local db dan server juga
                        const page = await createPage({ id: note.id }, {
                            pageNum: 1,
                            workspaceId: workspaceId,
                            workspaceNoteId: note.id,
                            isActive: true,
                            syncedAt: new Date(),
                            syncedId: generateUUID(),
                        });

                        console.log('note first page injected', page);
                    }
                }
            }
        }

        // 4. setelah dari local db dan server masih juga tidak ada
        // 5. buat note baru
        if (note === null) {
            // Brand-new note: there was never a server record to fetch.
            note = await initNote(workspaceId);
            console.log('create new note', note);

            const page = await createPage({ id: note.id }, {
                pageNum: 1,
                workspaceId: workspaceId,
                workspaceNoteId: note.id,
                isActive: true,
                syncedAt: new Date(),
                syncedId: generateUUID(),
            });
            console.log('create page note didn\'t exist', page);
        }

        // setelah semuanya diatas beres
        if (note) {
            // set active note
            setSelectedNote(note);
            console.log('active note', note);

            // get all pages
            const savedPages = await NotesRepository.getPagesByNoteId(note.id);
            console.log('getting pages', savedPages);
            setPages([...savedPages]);

            // get active page
            const activePage = savedPages.find((p: Page) => p.isActive === true);
            if (activePage) {
                setSelectedPage(activePage);
                console.log('active page', activePage);
            }
        }

        // di url params tidak ada noteId
        // set dengan yang baru
        if (!noteId) {
            handleUpdateUrlWithNoteId(note.id);
        }
    }

    // Reset state & editor saat berpindah antar note (mengatasi isu cache/stale data)
    useEffect(() => {
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

    return (
        <IonPage>
            <IonHeader className="ion-no-border">
                <IonToolbar>
                    <IonButtons slot="start" className="ion-padding-start">
                        <IonBackButton defaultHref="/" />
                    </IonButtons>

                    <IonTitle className='text-base ion-padding-start ion-padding-end line-clamp-1'>
                        {workspaceData?.title ?? 'Untitled Note'}
                    </IonTitle>

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
                            disabled={pages.length <= 1 || !selectedPage}
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
                    defaultValue={null}
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

                            // Don't let a pending autosave resurrect the page
                            // we're about to delete.
                            if (autosaveTimer.current) {
                                clearTimeout(autosaveTimer.current);
                                autosaveTimer.current = undefined;
                            }

                            try {
                                await NotesRepository.deletePage(pages[activeIndex].id, pages[activeIndex].syncedId);

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

                                await NotesRepository.updatePagesBulk(reindexed);
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