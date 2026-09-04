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
import { NoteFormatTypes, NotePageTypes, NoteTypes, useGetNoteByIdQuery, useUpsertNoteMutation } from '../../../../services/notes';
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
    const noteInitStarted = useRef(false);
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

    // RTK Query
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

    // Saves an explicit (page, delta) pair. Takes both as arguments rather
    // than reading them from refs/state at call time, so callers control
    // exactly what gets written where — this is what makes it safe to call
    // right before switching pages (see flushPendingSave / persistCurrentPage).
    const persistPageContent = useCallback(async (page: Partial<Page>, delta: Delta) => {
        setIsSaving(true);
        try {
            const contentEmpty = isDeltaEmpty(delta);
            const bufferData = contentEmpty ? null : Buffer.from(JSON.stringify(delta), 'utf-8');

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
    });

    useIonViewDidLeave(() => {
        setPages([]);
        setSelectedPage(null);
        setSelectedNote(null);
        noteInitStarted.current = false;
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
                } catch (error) {
                    console.error('Failed to parse saved content', error);
                }
            } else {
                if (quillRef.current) {
                    quillRef.current.setContents(new Delta());
                }
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
    useEffect(() => {
        if (!workspaceId) return;

        // We only need to wait on the server fetch when there IS a noteId to
        // fetch. When noteId is absent, the query is skipped and isLoading
        // never resolves, so gating on it unconditionally (as before) made
        // "create a brand-new note" unreachable — this effect would bail out
        // on every run and no note would ever get created.
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
                    // Same reasoning as the brand-new-note branch below:
                    // insertNote() already committed to the DB, so we let the
                    // rest of this block (sync + page creation) finish
                    // regardless of `cancelled`, and only guard setState.
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
                    // Don't bail out here even if `cancelled` — initNote()
                    // already wrote the note to the DB. A note with zero
                    // pages is an orphaned/inconsistent record, so we still
                    // finish creating its first page regardless. `cancelled`
                    // only needs to gate the setState calls (avoid reflecting
                    // stale data in the UI), not the DB writes themselves.
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
                    // noteId was provided, nothing local, and the server
                    // fetch failed — surface this instead of a silently
                    // blank editor.
                    presentToast({ message: 'Could not load this note.', duration: 2500, color: 'danger' });
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
        // eslint-disable-next-line react-hooks/exhaustive-deps -- upsertNote/presentToast are stable-ish;
        // including them risks re-running this effect (and re-creating a note) on unrelated identity changes.
    }, [workspaceId, noteId, noteData, gettingNote, gettingNoteError]);

    // Reset state & editor saat berpindah antar note (mengatasi isu cache/stale data)
    useEffect(() => {
        setPages([]);
        setSelectedPage(null);
        setSelectedNote(null);
        noteInitStarted.current = false;

        if (quillRef.current) {
            quillRef.current.setContents(new Delta());
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