import { IonAlert, IonBackButton, IonButton, IonButtons, IonContent, IonFooter, IonHeader, IonIcon, IonItem, IonLabel, IonList, IonNote, IonPage, IonProgressBar, IonSpinner, IonText, IonTitle, IonToolbar, useIonToast, useIonViewDidEnter, useIonViewDidLeave, useIonViewWillLeave } from "@ionic/react";
import { albums, albumsOutline, cameraOutline, checkmarkCircleOutline, cloudUploadOutline, copyOutline, trashOutline } from "ionicons/icons";
import { useCallback, useEffect, useRef, useState } from "react";
import './Page.css';
import { Note, Page } from "../../../../databases/entities/notes";
import NotesRepository from "../../../../databases/datasources/NotesRepository";
import ImageCapture from "../../../../components/image-capture/ImageCapture";
import { CameraResultType, Photo } from "@capacitor/camera";
import { NoteFormatTypes, NotePageTypes, useLazyGetNoteByIdQuery, useUpsertNoteMutation } from "../../../../services/notes";
import { useSearchParams } from "react-router-dom";
import { useGetWorkspaceByIdQuery } from "../../../../services/workspace";
import { generateUUID } from "../../../../utils/generator";
import { getUser } from "../../../../utils/authState";
import { uploadFileToGCS } from "../../../../utils/gcs-upload-client";
import { UploadProgress } from "../../../../types/upload";
import { FilePicker, PickedFile } from '@capawesome/capacitor-file-picker';
import { Capacitor } from '@capacitor/core';

interface FilePage extends Page {
    uploadProgress?: number | null;
    uploadError?: boolean;
}

// FilePicker mengembalikan `PickedFile`, bukan `File` bawaan browser yang
// dibutuhkan `uploadFileToGCS`. Bentuk `PickedFile` beda-beda tergantung
// platform, helper ini menormalkan semuanya jadi `File` biasa:
// - Web: `blob` sudah tersedia langsung.
// - Native (Android/iOS) tanpa `readData`: hanya ada `path`, dikonversi lewat
//   `Capacitor.convertFileSrc` + fetch (pola sama seperti `handleImageCaptured`
//   memproses `photo.webPath`).
// - Native dengan opsi `readData: true` saat pickFiles: `data` berisi base64.
const pickedFileToFile = async (pickedFile: PickedFile): Promise<File> => {
    if (pickedFile.blob) {
        return new File([pickedFile.blob], pickedFile.name, { type: pickedFile.mimeType });
    }

    if (pickedFile.path) {
        const fileSrc = Capacitor.convertFileSrc(pickedFile.path);
        const response = await fetch(fileSrc);
        const blob = await response.blob();
        return new File([blob], pickedFile.name, { type: pickedFile.mimeType || blob.type });
    }

    if (pickedFile.data) {
        const response = await fetch(`data:${pickedFile.mimeType};base64,${pickedFile.data}`);
        const blob = await response.blob();
        return new File([blob], pickedFile.name, { type: pickedFile.mimeType });
    }

    throw new Error(`Tidak bisa membaca file "${pickedFile.name}": tidak ada blob, path, maupun data.`);
};

const FilesEditorPage: React.FC = () => {
    const [presentToast] = useIonToast();
    const [searchParams, setSearchParams] = useSearchParams();
    const workspaceId = searchParams.get('workspaceId');
    const noteId = searchParams.get('noteId');

    const [pages, setPages] = useState<FilePage[]>([]);
    const [selectedNote, setSelectedNote] = useState<Note | null>(null);
    const [selectedPage, setSelectedPage] = useState<Partial<FilePage> | null>(null);

    const pagesRef = useRef<FilePage[]>([]);
    const selectedPageRef = useRef<Partial<FilePage> | null>(null);
    const selectedNoteRef = useRef<Note | null>(null);
    const ionContentRef = useRef<HTMLIonContentElement>(null);

    useEffect(() => { pagesRef.current = pages; }, [pages]);
    useEffect(() => { selectedPageRef.current = selectedPage; }, [selectedPage]);
    useEffect(() => { selectedNoteRef.current = selectedNote; }, [selectedNote]);

    const [showClearAlert, setShowClearAlert] = useState(false);
    const [showRemoveAlert, setShowRemoveAlert] = useState(false);

    const [isDirty, setIsDirty] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [hasContent, setHasContent] = useState(false);
    const autosaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const lastSavedDataRef = useRef<string | null>(null);
    const prevNoteIdRef = useRef<string | null>(searchParams.get('noteId'));

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
    const persistPageContent = useCallback(async (page: Partial<Page>, content: any) => {
        setIsSaving(true);
        try {
            const contentEmpty = false;
            const json = contentEmpty ? null : JSON.stringify(content);

            // Identical to the last thing we saved (typically a save
            // triggered right after a programmatic updateScene, not a real
            // edit) — skip the redundant DB write.
            if (json === lastSavedDataRef.current) return;
            lastSavedDataRef.current = json;

            const bufferData = json ? Buffer.from(json, 'utf-8') : null;

            await NotesRepository.updatePage(page.id as string, { contentData: bufferData }, false);
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
        if (!selectedPage) return;
        await persistPageContent(selectedPage, null);
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

    // Load content data for the active page into the editor.
    useEffect(() => {
        if (!selectedPage) return;

        const loadContentData = async () => {
            const contentData = selectedPage?.contentData;

            if (contentData) {
                try {
                    setHasContent(true);
                    // Seed the dedupe ref so the onChange this triggers
                    // doesn't cause an immediate, redundant re-save.
                    lastSavedDataRef.current = 'content value';
                } catch (error) {
                    console.error('Failed to parse saved content', error);
                }
            } else {
                setHasContent(false);
                lastSavedDataRef.current = null;
            }
        };

        loadContentData();
    }, [selectedPage]);

    // select page
    const selectPageHandler = async (page: FilePage) => {
        if (selectedPage?.id === page.id) return;

        try {
            // Flush any unsaved edits on the OUTGOING page before touching
            // selectedPage / swapping the editor's content.
            await flushPendingSave();

            const updatedPages = pages.map((p) => {
                delete p.uploadProgress;
                delete p.uploadError;
                return { ...p, isActive: p.id === page.id }
            });
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
    const newPageHandler = async (title: string | null = '') => {
        if (!selectedNote) return;

        try {
            await flushPendingSave();

            const prevPages = pages.map((p: Page) => ({ ...p, isActive: false }));
            if (prevPages.length > 0) {
                await NotesRepository.updatePagesBulk(prevPages);
            }

            await createPage(selectedNote, {
                title: title ?? 'Untitled Page',
                pageNum: pages.length + 1,
                workspaceId: selectedNote.workspaceId,
                workspaceNoteId: selectedNote.id,
                isActive: true,
                syncedAt: new Date(),
                syncedId: generateUUID(),
            });

            const updatedPages = (await NotesRepository.getPagesByNoteId(selectedNote.id)) as FilePage[];
            setPages(updatedPages.map(p => ({ ...p, uploadProgress: null })));

            const activePage = updatedPages.find((p) => p.isActive);
            if (activePage) {
                setSelectedPage(activePage);
            }
        } catch (err) {
            console.error('Failed to create a new page', err);
            presentToast({ message: 'Could not create a new page.', duration: 2500, color: 'danger' });
        }
    };

    // bulk create pages
    // `newPages` may already carry an `id` (set when the file behind it was
    // uploaded to GCS under that id as `pageId`) — reuse it here instead of
    // minting a fresh one, so the DB page ends up with the same id the
    // uploaded file was actually associated with.
    const bulkNewPagesHandler = async (newPages: FilePage[]) => {
        if (!selectedNote) return;

        try {
            await flushPendingSave();

            const prevPages = pages.map((p) => {
                delete p.uploadProgress;
                delete p.uploadError;
                return { ...p, isActive: false }
            });
            if (prevPages.length > 0) {
                await NotesRepository.updatePagesBulk(prevPages);
            }

            const pageLength = pages.length;
            const insertedPages = newPages.map((page, index) => {
                // `uploadProgress` is not part of this model, remove it
                delete page.uploadProgress;
                delete page.uploadError;

                const pageNum = (index + 1) + pageLength;
                return {
                    id: page.id ?? generateUUID(),
                    title: page.title ?? 'Untitled Page',
                    pageNum: pageNum,
                    workspaceId: selectedNote.workspaceId,
                    workspaceNoteId: selectedNote.id,
                    isActive: true,
                    syncedAt: new Date(),
                    syncedId: generateUUID(),
                }
            });

            // 2. insert pages ke database
            await NotesRepository.addPagesBulk(selectedNote, insertedPages);

            const updatedPages = (await NotesRepository.getPagesByNoteId(selectedNote.id)) as FilePage[];
            setPages(updatedPages.map(p => ({ ...p, uploadProgress: null })));

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
            contentType: "file",
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
                        // const page = await createPage({ id: note.id }, {
                        //     pageNum: 1,
                        //     workspaceId: workspaceId,
                        //     workspaceNoteId: note.id,
                        //     isActive: true,
                        //     syncedAt: new Date(),
                        //     syncedId: generateUUID(),
                        // });

                        // console.log('note first page injected', page);
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

            // const page = await createPage({ id: note.id }, {
            //     pageNum: 1,
            //     workspaceId: workspaceId,
            //     workspaceNoteId: note.id,
            //     isActive: true,
            //     syncedAt: new Date(),
            //     syncedId: generateUUID(),
            // });
            // console.log('create page note didn\'t exist', page);
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
        }
    }, [noteId]);

    // --- CAPTURE IMAGE AND UPLOAD FUNCTION ---
    const handleImageCaptured = async (photo: Photo) => {
        if (!selectedPage || !photo || !photo.webPath) return;

        ionContentRef.current?.scrollToBottom(0);

        const response = await fetch(photo.webPath);
        const blob = await response.blob();

        const file = new File(
            [blob],
            'image.png',
            { type: blob.type }
        );

        // let progress = 0;
        // const user = await getUser();
        // const result = await uploadFileToGCS(
        //     file,
        //     { onProgress: (p: UploadProgress) => { progress = p.percentage; } },
        //     {
        //         pageId: selectedPage?.id,
        //         workspaceId: workspaceId,
        //     }
        // );

        // console.log('Image captured:', photo);
        // do something with the imageUri, e.g., set it to state
    };

    const handleError = (error: Error) => {
        console.error('Image capture error:', error);
    };
    // --- END CAPTURE IMAGE AND UPLOAD FUNCTION ---

    // --- SELECT FILE AND UPLOAD FUNCTION ---
    const selectFile = async () => {
        const user = await getUser();
        let result;

        try {
            result = await FilePicker.pickFiles({
                types: [
                    'application/pdf',
                    'application/msword',
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    'text/plain',
                    'image/png',
                    'image/jpeg',
                    'image/jpg',
                    'image/gif',
                    'image/webp',
                    'audio/mpeg',      // .mp3
                    'audio/wav',       // .wav
                    'audio/x-wav',     // .wav (varian beberapa browser)
                    'audio/ogg',       // .ogg
                    'audio/webm',      // .webm audio
                    'audio/mp4',       // .m4a
                    'audio/x-m4a',     // .m4a (varian Safari/iOS)
                    'audio/aac',       // .aac
                    'audio/flac',      // .flac
                ],
                limit: 0,
            });
        } catch (err) {
            console.error('Failed to open file picker', err);
            return;
        }

        console.log('select file', result);
        if (!result.files.length) return;

        ionContentRef.current?.scrollToBottom(0);

        // Buat entry sementara dulu untuk tiap file yang dipilih, supaya progress
        // upload-nya kelihatan di list selagi masih berjalan (belum tersimpan di DB).
        const tempEntries: FilePage[] = result.files.map((file) => ({
            id: generateUUID(),
            title: file.name,
            uploadProgress: 0,
            uploadError: false,
            userId: user.id,
        } as FilePage));

        setPages((prev) => [...prev, ...tempEntries]);

        const successfulPages: FilePage[] = [];
        const existingPageCount = pages.length;

        // Upload satu per satu secara berurutan (bukan Promise.all / .map),
        // supaya urutannya A -> B -> C dan progress masing-masing bisa dipantau.
        for (let i = 0; i < result.files.length; i++) {
            const pickedFile = result.files[i];
            const tempId = tempEntries[i].id as string;

            try {
                // PickedFile -> File asli dulu, baru bisa dioper ke uploadFileToGCS
                const file = await pickedFileToFile(pickedFile);
                const result = await uploadFileToGCS(
                    file,
                    {
                        onProgress: (p: UploadProgress) => {
                            setPages((prev) =>
                                prev.map((page) =>
                                    page.id === tempId
                                        ? { ...page, uploadProgress: p.percentage }
                                        : page
                                )
                            );
                        },
                    },
                    {
                        // pakai id yang sama dengan tempEntries, nanti id ini juga
                        // dipakai sebagai id page asli di bulkNewPagesHandler,
                        // jadi file yang ter-upload konsisten terhubung ke page-nya.
                        pageId: tempId,
                        workspaceId: workspaceId,
                    }
                );

                // create page directly after upload sucess
                if (selectedNote) {
                    const pageNum = existingPageCount + i + 1;
                    const newPage = await createPage(selectedNote, {
                        title: file.name ?? 'Untitled Page',
                        pageNum: pageNum,
                        workspaceId: selectedNote.workspaceId,
                        workspaceNoteId: selectedNote.id,
                        isActive: true,
                        syncedAt: new Date(),
                        syncedId: generateUUID(),
                        contentData: Buffer.from(JSON.stringify(result)),
                    });

                    setPages((prev) =>
                        prev.map((page) =>
                            page.id === tempId
                                ? { ...page, uploadProgress: null, id: newPage.id, pageNum: pageNum }
                                : page
                        )
                    );
                }

                successfulPages.push({
                    id: tempId,
                    title: pickedFile.name,
                    uploadProgress: null,
                } as FilePage);
            } catch (err) {
                // pakai pickedFile.name (bukan file.name) karena kalau
                // pickedFileToFile sendiri yang gagal, `file` belum sempat ada
                console.error(`Failed to upload file "${pickedFile.name}"`, err);
                presentToast({
                    message: `Gagal mengunggah "${pickedFile.name}", lanjut ke file berikutnya.`,
                    duration: 2500,
                    color: 'danger',
                });

                // tandai entry ini gagal di UI, lalu lanjut ke file berikutnya
                // (tidak throw / break, biar loop tetap jalan)
                setPages((prev) =>
                    prev.map((page) =>
                        page.id === tempId
                            ? { ...page, uploadProgress: null, uploadError: true }
                            : page
                    )
                );
            }
        }

        // Buang semua entry sementara — yang sukses akan digantikan oleh data
        // asli dari DB lewat bulkNewPagesHandler, yang gagal memang tidak perlu
        // tetap nampang (toast sudah memberi tahu file mana yang gagal).
        setPages((prev) => prev.filter((page) => !tempEntries.some((t) => t.id === page.id)));

        // if (successfulPages.length > 0) {
        //     await bulkNewPagesHandler(successfulPages);
        // }
    };
    // --- END SELECT FILE AND UPLOAD FUNCTION ---

    return (
        <IonPage>
            <IonHeader className='ion-no-border'>
                <IonToolbar>
                    <IonButtons slot="start" className="ion-padding-start">
                        <IonBackButton defaultHref="/" />
                    </IonButtons>

                    <IonTitle className='text-base ion-padding-start ion-padding-end line-clamp-1'>
                        {workspaceData?.title ?? 'Untitled Note'}
                    </IonTitle>
                </IonToolbar>
            </IonHeader>

            <IonContent ref={ionContentRef}>
                {pages.length === 0 && (
                    <div className='flex flex-col items-center justify-center h-full ion-padding'>
                        <IonIcon icon={albumsOutline} className="text-4xl mb-2"></IonIcon>
                        <IonText className="text-sm text-center w-2/3 mx-auto" color={'medium'}>
                            No files uploaded yet. Tap button to upload a file.
                        </IonText>
                    </div>
                )}

                {pages.length > 0 && (
                    <IonList lines='full'>
                        {[...pages].map((page: FilePage, index, array) => {
                            const isLast = index === array.length - 1;
                            const isUploading = page.uploadProgress !== null && page.uploadProgress !== undefined;

                            return (
                                <IonItem lines={isLast ? 'none' : 'full'} key={page.id}>
                                    <div slot="start" className="ion-padding-end w-8">
                                        {isUploading && (page.uploadProgress ?? 0) < 100 && (
                                            <IonSpinner name="crescent" color="primary" className="w-4 h-4" />
                                        )}

                                        {(page.uploadProgress ?? 0) >= 100 && (
                                            <IonIcon icon={checkmarkCircleOutline} className="text-lg" color="success"></IonIcon>
                                        )}

                                        {page.pageNum && <IonNote className="underline">{page.pageNum ?? '-'}.</IonNote>}
                                    </div>
                                    <IonLabel className="py-2 !text-sm">
                                        {page.title || `Page ${page.pageNum}`}

                                        {isUploading && (
                                            <IonProgressBar
                                                value={(page.uploadProgress ?? 0) / 100}
                                                color="primary"
                                                className="mt-1"
                                            />
                                        )}

                                        {page.uploadError && (
                                            <IonNote color="danger" className="block !text-xs mt-1">
                                                Gagal diunggah
                                            </IonNote>
                                        )}
                                    </IonLabel>

                                    <div slot="end" className="ion-padding-start">
                                        {!isUploading && (
                                            <IonButton
                                                shape="round"
                                                size="small"
                                                color="light"
                                                onClick={() => {
                                                    setShowRemoveAlert(true)
                                                    setSelectedPage(page);
                                                }}
                                            >
                                                <IonIcon icon={trashOutline} slot='icon-only' color={'danger'}></IonIcon>
                                            </IonButton>
                                        )}
                                    </div>
                                </IonItem>
                            );
                        })}
                    </IonList>
                )}
            </IonContent>

            <IonFooter className="w-full py-3 ion-no-border">
                <div style={{ paddingBottom: 'var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0))' }}>
                    <div className='px-3 text-center'>
                        <IonText className="text-sm text-center w-full" color={'medium'}>Upload PDF, DOCX, TXT, Image and Audio Files</IonText>
                        <div className='flex-1 mt-2'>
                            <div className="flex justify-center gap-4">
                                <div className="flex items-center gap-4">
                                    <IonButton
                                        shape="round"
                                        color={'dark'}
                                        onClick={selectFile}
                                    >
                                        <IonIcon icon={cloudUploadOutline} slot="start"></IonIcon>
                                        <IonText className="ml-2">Select File</IonText>
                                    </IonButton>

                                    <ImageCapture
                                        resultType={CameraResultType.Uri}
                                        onImageCaptured={handleImageCaptured}
                                        onError={handleError}
                                        quality={90}               // Optional: default is 90
                                        allowEditing={true}        // Optional: allows cropping/editing (default false)
                                    >
                                        <IonButton
                                            shape="round"
                                            color={'dark'}
                                        >
                                            <IonIcon icon={cameraOutline} slot="icon-only"></IonIcon>
                                        </IonButton>
                                    </ImageCapture>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </IonFooter>

            {/* remove page alert */}
            <IonAlert
                isOpen={showRemoveAlert}
                onDidDismiss={() => setShowRemoveAlert(false)}
                header='Are you sure to remove this file?'
                message={'This file and everything in it will be permanently deleted.'}
                buttons={[
                    { text: 'Cancel', role: 'cancel' },
                    {
                        text: 'Yes',
                        role: 'destructive',
                        handler: async () => {
                            if (!selectedPage) return;

                            let activeIndex = pages.findIndex((p) => p.isActive);
                            if (activeIndex === -1) {
                                activeIndex = pages.findIndex(p => p.id == selectedPage.id);
                            };

                            // delete page from db
                            await NotesRepository.deletePage(
                                pages[activeIndex].id,
                                pages[activeIndex].syncedId,
                                pages[activeIndex].workspaceId,
                                pages[activeIndex].workspaceNoteId,
                            );

                            const filtered = pages.filter((_, idx) => idx !== activeIndex);

                            // tidak ada page tersisa -> clear canvas
                            if (filtered.length === 0) {
                                setPages([]);
                                return;
                            }

                            // pilih page berikutnya kalau ada, atau page sebelumnya kalau yang dihapus adalah terakhir
                            const nextActiveIndex = Math.min(activeIndex, filtered.length - 1);

                            // re-index all pages
                            const reindexed = filtered.map((p, idx) => {
                                delete p.uploadProgress;
                                delete p.uploadError;

                                return {
                                    ...p,
                                    pageNum: idx + 1,
                                    isActive: idx === nextActiveIndex,
                                }
                            });

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
    )
}

export default FilesEditorPage;