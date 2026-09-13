import { IonAlert, IonBackButton, IonButton, IonButtons, IonCard, IonCardContent, IonCardHeader, IonContent, IonFooter, IonHeader, IonIcon, IonItem, IonLabel, IonList, IonModal, IonNote, IonPage, IonProgressBar, IonSpinner, IonText, IonTitle, IonToolbar, useIonToast, useIonViewDidEnter, useIonViewDidLeave, useIonViewWillLeave } from "@ionic/react";
import { albums, albumsOutline, cameraOutline, checkmarkCircleOutline, closeOutline, cloudUploadOutline, copyOutline, trashOutline } from "ionicons/icons";
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
import { getFileTypePure, uploadFileToGCS } from "../../../../utils/gcs-upload-client";
import { UploadProgress } from "../../../../types/upload";
import { FilePicker, PickedFile } from '@capawesome/capacitor-file-picker';
import { Capacitor } from '@capacitor/core';
import { supabase } from "../../../../lib/supabase";

interface FilePage extends Page {
    uploadProgress?: number | null;
    uploadError?: boolean;
    isSaving?: boolean;
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
    const isProcessed = Boolean(searchParams.get('clusteredDate'));

    const [viewImage, setViewImage] = useState<any>(null);
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

    const [showRemoveAlert, setShowRemoveAlert] = useState(false);
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

    // Ionic's router outlet keeps pages mounted in its history stack, so plain
    // unmount isn't a reliable "user is leaving" signal — flush explicitly.
    useIonViewWillLeave(() => {
        // pass
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

    // select page
    const selectPageHandler = async (page: FilePage) => {
        if (selectedPage?.id === page.id) return;

        try {
            // Flush any unsaved edits on the OUTGOING page before touching
            // selectedPage / swapping the editor's content.
            // if (!isProcessed) await flushPendingSave();

            const updatedPages = pages.map((p) => {
                // hilangkan karena bukan bagian dari table database
                delete p.uploadProgress;
                delete p.uploadError;
                delete p.isSaving;

                return { ...p, isActive: p.id === page.id }
            });
            if (!isProcessed) await NotesRepository.updatePagesBulk(updatedPages);
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
            status: 'draft',
            processingStatus: 'pending',
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
                const { data: serverNote } = await getNoteById({ id: noteId, workspace_id: workspaceId });
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
                                    status: p.status,
                                    processingStatus: p.processing_status,
                                    isActive: p.is_active,
                                    syncedId: p.synced_id ? p.synced_id : generateUUID(),
                                    syncedAt: p.synced_at ? new Date(p.synced_at) : new Date(),
                                    note: { id: serverNote.id },
                                    attributes: p.attributes,
                                }
                            })
                        : [];

                    if (injectedPages.length > 0) {
                        const savedPages = await NotesRepository.addPagesBulk({ id: serverNote.id }, injectedPages);
                        console.log("injected pages", savedPages);
                    }
                }
            }
        }

        // 4. setelah dari local db dan server masih juga tidak ada
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
    }

    // Reset state & editor saat berpindah antar note (mengatasi isu cache/stale data)
    useEffect(() => {
        if (prevNoteIdRef.current !== noteId) {
            setPages([]);
            setSelectedPage(null);
            setSelectedNote(null);
            prevNoteIdRef.current = noteId;
        }
    }, [noteId]);

    // --- CAPTURE IMAGE AND UPLOAD FUNCTION ---
    const handleImageCaptured = async (photo: Photo) => {
        if (!selectedPage || !photo || !photo.webPath) return;
        let note: any = null;
        if (!workspaceId) return;
        if (!selectedNote) {
            // buat catatan dulu
            const newNote = await initNote(workspaceId);
            if (!noteId) {
                handleUpdateUrlWithNoteId(newNote.id);
            }

            note = newNote;
            setSelectedNote(newNote);
            console.log('active note', newNote);
        } else {
            note = selectedNote;
        }

        ionContentRef.current?.scrollToBottom(0);

        const user = await getUser();
        const response = await fetch(photo.webPath);
        const blob = await response.blob();
        const url = new URL(photo.webPath);
        const fileName = url.pathname.split('/').pop() || 'image.png';

        const pickedFile = new File(
            [blob],
            fileName,
            { type: blob.type }
        );

        // temp page
        const tempEntry = {
            id: generateUUID(),
            title: pickedFile.name,
            uploadProgress: 0,
            uploadError: false,
            userId: user.id,
            workspaceId: workspaceId,
            workspaceNoteId: note?.id,
            syncedId: generateUUID(),
            syncedAt: new Date(),
        } as FilePage;

        setPages((prev) => [...prev, tempEntry]);

        try {
            // PickedFile -> File asli dulu, baru bisa dioper ke uploadFileToGCS
            const file = await pickedFileToFile({
                blob: pickedFile,
                mimeType: blob.type,
                name: fileName,
                size: blob.size,
            });

            const result = await uploadFileToGCS(
                file,
                {
                    onProgress: (p: UploadProgress) => {
                        setPages((prev) =>
                            prev.map((page) =>
                                page.id === tempEntry.id
                                    ? {
                                        ...page,
                                        uploadProgress: p.percentage,
                                        isSaving: true,
                                    }
                                    : page
                            )
                        );
                    },
                },
                {
                    // pakai id yang sama dengan tempEntries, nanti id ini juga
                    // dipakai sebagai id page asli di bulkNewPagesHandler,
                    // jadi file yang ter-upload konsisten terhubung ke page-nya.
                    pageId: tempEntry.id,
                    workspaceId: workspaceId,
                    workspaceNoteId: note?.id,
                }
            );

            // create page directly after upload sucess
            if (note) {
                const existingPageCount = pages.length;
                const pageNum = existingPageCount + 1;
                const newPage = await createPage(note, {
                    title: file.name ?? 'Untitled Page',
                    pageNum: pageNum,
                    workspaceId: note.workspaceId,
                    workspaceNoteId: note.id,
                    isActive: true,
                    syncedAt: new Date(),
                    syncedId: generateUUID(),
                    status: 'draft', // directly as published karena user tidak bisa edit
                    processingStatus: 'pending',
                });

                // relasikan file dengan attachment
                // kemudian relasikan attachment dengan page
                // save the file
                const filePayload = {
                    user_id: user.id,
                    disk: 'gcs/atlafiles', // <storage_platform>/<bucket_name>
                    file_type: getFileTypePure(file.type), // actually only use like 'image', 'pdf', 'audio', etc not an mime_type such as image/png
                    mime_type: result.contentType,
                    original_filename: file.name,
                    size_bytes: result.size,
                    created_at: result.timeCreated,
                    updated_at: result.updated,
                    checksum_sha256: result.md5Hash,
                    path: result.name,
                    media_link: result.mediaLink
                };

                // save file metadata
                const { data: fileData, error: fileError } = await supabase.from("files")
                    .insert(filePayload)
                    .select('*')
                    .single();

                // create attachment
                const attachmentPayload = {
                    file_id: fileData.id,
                    user_id: user.id,
                    entity_type: 'workspace_notes_pages',
                    entity_id: newPage.id,
                    purpose: 'captured_notebook',
                }

                const { data: attachmentData, error: attachmentError } = await supabase.from("attachments")
                    .insert(attachmentPayload)
                    .select('*')
                    .single();

                const attributes = {
                    file: fileData,
                    attachment: attachmentData,
                }

                // update page with file metadata
                await NotesRepository.updatePage(newPage.id as string, { attributes: attributes });

                setPages((prev) =>
                    prev.map((page) =>
                        page.id === tempEntry.id
                            ? {
                                ...page,
                                pageNum: pageNum,
                                uploadProgress: null,
                                isSaving: false,
                                attributes: attributes,
                                status: 'draft',
                                processingStatus: 'pending',
                            }
                            : page
                    )
                );
            }

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
                    page.id === tempEntry.id
                        ? {
                            ...page,
                            uploadProgress: null,
                            uploadError: true,
                            isSaving: false,
                        }
                        : page
                )
            );
        }
    };

    const handleError = (error: Error) => {
        console.error('Image capture error:', error);
    };
    // --- END CAPTURE IMAGE AND UPLOAD FUNCTION ---

    // --- SELECT FILE AND UPLOAD FUNCTION ---
    const selectFile = async () => {
        let note: any = null;
        if (!workspaceId) return;
        if (!selectedNote) {
            // buat catatan dulu
            const newNote = await initNote(workspaceId);
            if (!noteId) {
                handleUpdateUrlWithNoteId(newNote.id);
            }

            note = newNote;
            setSelectedNote(newNote);
            console.log('active note', newNote);
        } else {
            note = selectedNote;
        }

        const user = await getUser();
        let result;

        try {
            result = await FilePicker.pickFiles({
                types: [
                    'image/png',
                    'image/jpeg',
                    'image/jpg',
                    'image/gif',
                    'image/webp',
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
            workspaceId: workspaceId,
            workspaceNoteId: note?.id,
            syncedId: generateUUID(),
            syncedAt: new Date(),
        } as FilePage));

        setPages((prev) => [...prev, ...tempEntries]);

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
                                        ? {
                                            ...page,
                                            uploadProgress: p.percentage,
                                            isSaving: true,
                                        }
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
                        workspaceNoteId: note?.id,
                    }
                );

                // create page directly after upload sucess
                if (note) {
                    const pageNum = existingPageCount + i + 1;
                    const newPage = await createPage(note, {
                        title: file.name ?? 'Untitled Page',
                        pageNum: pageNum,
                        workspaceId: note.workspaceId,
                        workspaceNoteId: note.id,
                        isActive: true,
                        syncedAt: new Date(),
                        syncedId: generateUUID(),
                        status: 'draft', // directly as published karena user tidak bisa edit
                        processingStatus: 'pending',
                    });

                    // relasikan file dengan attachment
                    // kemudian relasikan attachment dengan page
                    // save the file
                    const filePayload = {
                        user_id: user.id,
                        disk: 'gcs/atlafiles', // <storage_platform>/<bucket_name>
                        file_type: getFileTypePure(file.type), // actually only use like 'image', 'pdf', 'audio', etc not an mime_type such as image/png
                        mime_type: result.contentType,
                        original_filename: file.name,
                        size_bytes: result.size,
                        created_at: result.timeCreated,
                        updated_at: result.updated,
                        checksum_sha256: result.md5Hash,
                        path: result.name,
                        media_link: result.mediaLink
                    };

                    // save file metadata
                    const { data: fileData, error: fileError } = await supabase.from("files")
                        .insert(filePayload)
                        .select('*')
                        .single();

                    // create attachment
                    const attachmentPayload = {
                        file_id: fileData.id,
                        user_id: user.id,
                        entity_type: 'workspace_notes_pages',
                        entity_id: newPage.id,
                        purpose: 'captured_notebook',
                    }

                    const { data: attachmentData, error: attachmentError } = await supabase.from("attachments")
                        .insert(attachmentPayload)
                        .select('*')
                        .single();

                    const attributes = {
                        file: fileData,
                        attachment: attachmentData,
                    }

                    // update page with file metadata
                    await NotesRepository.updatePage(newPage.id as string, { attributes: attributes });

                    setPages((prev) =>
                        prev.map((page) =>
                            page.id === tempId
                                ? {
                                    ...page,
                                    pageNum: pageNum,
                                    uploadProgress: null,
                                    isSaving: false,
                                    attributes: attributes,
                                    status: 'draft',
                                    processingStatus: 'pending',
                                }
                                : page
                        )
                    );
                }

            } catch (err) {
                // pakai pickedFile.name (bukan file.name) karena kalau
                // pickedFileToFile sendiri yang gagal, `file` belum sempat ada
                console.error(`Failed to upload file "${pickedFile.name}"`, err);
                presentToast({
                    message: `Failed to upload "${pickedFile.name}", going to upload next...`,
                    duration: 2500,
                    color: 'danger',
                });

                // tandai entry ini gagal di UI, lalu lanjut ke file berikutnya
                // (tidak throw / break, biar loop tetap jalan)
                setPages((prev) =>
                    prev.map((page) =>
                        page.id === tempId
                            ? {
                                ...page,
                                uploadProgress: null,
                                uploadError: true,
                                isSaving: false,
                            }
                            : page
                    )
                );
            }
        }
    };
    // --- END SELECT FILE AND UPLOAD FUNCTION ---

    // ...
    // save changes
    // ...
    const handleSaveChanges = async () => {
        if (!selectedNoteRef?.current?.id) return;

        const updatedPages = pages.map(p => {
            delete p.uploadError;
            delete p.uploadProgress;
            delete p.isSaving;

            // @ts-ignore
            delete p.isActive;

            return {
                ...p,
                status: 'published' as any,
            };
        });

        // update semua pages as published
        await NotesRepository.updatePagesBulk(updatedPages);
        setPages(updatedPages);

        // update note dari 'draft' ke 'publish'
        // tujuannya untuk start embedding
        await NotesRepository.updateNote({
            id: selectedNoteRef.current.id,
            status: 'published',
        });

        setSelectedNote((prev: Note | null) => {
            if (!prev) return prev;
            return {
                ...prev,
                status: 'published',
            };
        });

        presentToast('Note saved successfully!', 1000);
    }

    return (
        <IonPage>
            <IonHeader className='ion-no-border'>
                <IonToolbar>
                    <IonButtons slot="start" className="ion-padding-start">
                        <IonBackButton defaultHref="/dashboard" />
                    </IonButtons>

                    <IonTitle className='text-sm ion-padding-start ion-padding-end line-clamp-1'>
                        {workspaceData?.title ?? 'Untitled Note'}
                    </IonTitle>

                    {pages.some(p => p.status === 'draft') && (
                        <IonButtons slot="end" className="ion-padding-end">
                            <IonButton
                                fill="solid"
                                color="primary"
                                size="small"
                                mode="ios"
                                shape="round"
                                className="normal-button"
                                style={{ '--padding-top': '6px', '--padding-bottom': '6px' }}
                                onClick={handleSaveChanges}
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
                </IonToolbar>
            </IonHeader>

            <IonContent ref={ionContentRef} className="ion-padding">
                {pages.length === 0 && (
                    <div className='flex flex-col items-center justify-center h-full ion-padding'>
                        <IonIcon icon={albumsOutline} className="text-4xl mb-2"></IonIcon>
                        <IonText className="text-sm text-center w-2/3 mx-auto" color={'medium'}>
                            No files uploaded yet. Tap button to upload a file.
                        </IonText>
                    </div>
                )}

                {pages.length > 0 && (
                    <div className="grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
                        {[...pages].map((page: FilePage, index, array) => {
                            const isUploading = page.uploadProgress !== null && page.uploadProgress !== undefined;

                            return (
                                <div key={page.id} className="block">
                                    <IonCard className="rounded-xl" onClick={() => setViewImage(page)}>
                                        <IonCardContent>
                                            <div className="relative aspect-square">
                                                {(isUploading && ((page.uploadProgress ?? 0) < 100 || page.isSaving)) && (
                                                    <div className="absolute top-0 right-0 bottom-0 left-0 flex items-center justify-center">
                                                        <IonSpinner name="crescent" color="primary" className="w-4 h-4" />
                                                    </div>
                                                )}

                                                {(page.pageNum && page.attributes) && (
                                                    <div className="absolute top-0 right-0 bottom-0 left-0">
                                                        <img src={page?.attributes?.file?.media_link} className="h-full w-full object-cover" />
                                                    </div>
                                                )}
                                            </div>
                                        </IonCardContent>
                                    </IonCard>

                                    <div className="block ion-text-center pt-2">
                                        {!isUploading && (
                                            <div className="flex items-center justify-between">
                                                <div className="w-5 h-5 text-neutral-700 bg-neutral-100 shadow rounded-full flex items-center justify-center text-xs font-semibold">{page.pageNum}</div>
                                                <div className="flex items-center justify-end flex-1">
                                                    <IonButton
                                                        fill="clear"
                                                        mode="ios"
                                                        color="primary"
                                                        size="small"
                                                        onClick={() => {
                                                            setShowRemoveAlert(true)
                                                            setSelectedPage(page);
                                                        }}
                                                    >
                                                        <IonText className="ml-1">Delete</IonText>
                                                    </IonButton>
                                                </div>
                                            </div>
                                        )}

                                        {(isUploading || page.isSaving) && (
                                            <div className="ion-padding-start ion-padding-end">
                                                <IonProgressBar
                                                    value={(page.uploadProgress ?? 0) / 100}
                                                    color="primary"
                                                    className="mt-3 h-2 rounded-full"
                                                />
                                            </div>
                                        )}

                                        {page.uploadError && (
                                            <IonText color="danger" className="block !text-xs ion-text-center">
                                                Upload failed!
                                            </IonText>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </IonContent>

            {!isProcessed && (
                <IonFooter className="w-full py-3 ion-no-border">
                    <div style={{ paddingBottom: 'var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0))' }}>
                        <div className='px-3 text-center'>
                            <IonText className="text-sm text-center w-full" color={'medium'}>
                                Upload your current notes from the book.
                            </IonText>
                            <div className='flex-1 mt-2'>
                                <div className="flex justify-center gap-4">
                                    <div className="flex items-center gap-4">
                                        <IonButton
                                            shape="round"
                                            color={'light'}
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
                                                color={'light'}
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
            )}

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

                            let activeIndex = pages.findIndex(p => p.id === selectedPage.id);
                            if (activeIndex === -1) {
                                activeIndex = pages.findIndex((p) => p.isActive);
                            }

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
                                delete p.isSaving;

                                return {
                                    ...p,
                                    pageNum: idx + 1,
                                    isActive: idx === nextActiveIndex,
                                }
                            });

                            // set current active page
                            const newSelected = reindexed.find((p) => p.isActive);
                            if (newSelected) {
                                setSelectedPage(newSelected);
                            }

                            setPages(reindexed);
                            await NotesRepository.updatePagesBulk(reindexed);
                        },
                    },
                ]}
            ></IonAlert>

            {/* image viewer */}
            <IonModal isOpen={!!viewImage} onDidDismiss={() => setViewImage(null)}
                className='rounded-2xl'
            >
                <IonHeader className="ion-no-border">
                    <IonToolbar>
                        <IonButton slot="end" onClick={() => setViewImage(null)} shape="round" color={'light'} className="ion-margin-end">
                            <IonIcon icon={closeOutline} slot="icon-only" />
                        </IonButton>
                    </IonToolbar>
                </IonHeader>
                <IonContent>
                    {viewImage && (
                        <div className="flex items-center justify-center h-full">
                            <img src={viewImage?.attributes?.file?.media_link} alt="" className="max-w-full max-h-full" />
                        </div>
                    )}
                </IonContent>
            </IonModal>
        </IonPage>
    )
}

export default FilesEditorPage;