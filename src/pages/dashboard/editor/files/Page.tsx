import { IonAlert, IonBackButton, IonButton, IonButtons, IonCard, IonCardContent, IonCardHeader, IonContent, IonFooter, IonHeader, IonIcon, IonItem, IonLabel, IonList, IonModal, IonNote, IonPage, IonProgressBar, IonSpinner, IonText, IonTitle, IonToolbar, useIonRouter, useIonToast, useIonViewDidEnter, useIonViewDidLeave, useIonViewWillLeave } from "@ionic/react";
import { albums, albumsOutline, cameraOutline, checkmarkCircleOutline, closeOutline, cloudUploadOutline, copyOutline, documentText, trashOutline } from "ionicons/icons";
import { useCallback, useEffect, useRef, useState } from "react";
import './Page.css';
import { Note, Page } from "../../../../databases/entities/notes";
import NotesRepository from "../../../../databases/datasources/NotesRepository";
import ImageCapture from "../../../../components/image-capture/ImageCapture";
import { CameraResultType, Photo } from "@capacitor/camera";
import { NoteFormatTypes, NotePageTypes, useLazyGetNoteByIdQuery } from "../../../../services/notes";
import { useSearchParams } from "react-router-dom";
import { useGetWorkspaceByIdQuery } from "../../../../services/workspace";
import { generateUUID } from "../../../../utils/generator";
import { getUser } from "../../../../utils/authState";
import { getFileTypePure, uploadFileToGCS } from "../../../../utils/gcs-upload-client";
import { UploadProgress } from "../../../../types/upload";
import { FilePicker, PickedFile } from '@capawesome/capacitor-file-picker';
import { Capacitor } from '@capacitor/core';
import { supabase } from "../../../../lib/supabase";
import { useGetLearningSessionByIdQuery } from "../../../../services/learning.session";

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
    const ionRouter = useIonRouter();
    const [presentToast] = useIonToast();
    const [searchParams, setSearchParams] = useSearchParams();
    const workspaceId = searchParams.get('workspaceId');
    const noteId = searchParams.get('noteId');
    const sessionId = searchParams.get('sessionId');
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
    const [getNoteById] = useLazyGetNoteByIdQuery();
    const { data: workspaceData } = useGetWorkspaceByIdQuery(workspaceId ?? "", { skip: !workspaceId });
    const { data: sessionData } = useGetLearningSessionByIdQuery(sessionId ?? "", { skip: !sessionId });

    const handleUpdateUrlWithNoteId = (newNoteId: string) => {
        prevNoteIdRef.current = newNoteId;
        const newParams = new URLSearchParams(searchParams);
        newParams.set('noteId', newNoteId);
        setSearchParams(newParams, { replace: true });
    };

    useIonViewDidEnter(() => {
        window.dispatchEvent(new Event('resize'));
        if (workspaceId) {
            contentLoader(workspaceId, noteId);
        }
    }, [noteId, workspaceId]);

    useIonViewDidLeave(() => {
        setPages([]);
        setSelectedPage(null);
        setSelectedNote(null);
        prevNoteIdRef.current = null;
    });

    // Reset state & editor saat berpindah antar note
    useEffect(() => {
        if (prevNoteIdRef.current !== noteId) {
            setPages([]);
            setSelectedPage(null);
            setSelectedNote(null);
            prevNoteIdRef.current = noteId;
        }
    }, [noteId]);

    // --- CRUD NOTES ---
    const initNote = async (workspaceId: string, sessionId: string | null = null): Promise<Note> => {
        const user = await getUser();
        return await NotesRepository.insertNote({
            workspaceId,
            userId: user?.id ?? '',
            title: "Untitled Note",
            content: "",
            noteDatetime: sessionData?.ended_at ?? new Date().toISOString(),
            createdAt: new Date().toISOString(),
            contentType: "file",
            status: 'draft',
            processingStatus: 'pending',
            learningSessionId: sessionId ?? '',
            syncedId: generateUUID(),
            syncedAt: new Date().toISOString(),
        }, true);
    }

    const createPage = async (note: Partial<Note>, data: Partial<Page>, syncToServer: boolean = true): Promise<Page> => {
        const user = await getUser();
        return await NotesRepository.addPage(
            { id: note.id },
            { ...data, userId: user.id ?? '' },
            syncToServer
        );
    }
    // --- END CRUD NOTES ---

    const contentLoader = async (workspaceId: string, currentNoteId: string | null = null) => {
        let note: Note | null = null;

        if (currentNoteId) {
            note = await NotesRepository.getNoteById(currentNoteId);

            if (!note) {
                const { data: serverNote } = await getNoteById({ id: currentNoteId });

                if (serverNote) {
                    const nData = {
                        id: serverNote.id,
                        workspaceId,
                        title: serverNote.title || "Untitled Note",
                        content: serverNote.content,
                        status: serverNote.status,
                        processingStatus: serverNote.processing_status,
                        noteDatetime: serverNote.note_datetime ?? new Date().toISOString(),
                        contentType: serverNote.content_type as NoteFormatTypes,
                        syncedId: serverNote.synced_id ?? generateUUID(),
                        syncedAt: serverNote.synced_at ?? new Date().toISOString(),
                        createdAt: serverNote.created_at ?? new Date().toISOString(),
                        learningSessionId: sessionId ?? '',
                    };

                    note = await NotesRepository.insertNote(nData);

                    const injectedPages = (serverNote.pages || [])
                        .slice()
                        .sort((a: NotePageTypes, b: NotePageTypes) => a.page_num - b.page_num)
                        .map((p: NotePageTypes) => ({
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
                            syncedId: p.synced_id ?? generateUUID(),
                            syncedAt: p.synced_at ?? new Date().toISOString(),
                            createdAt: p.created_at ?? new Date().toISOString(),
                            note: { id: serverNote.id },
                            attributes: p.attributes,
                            learningSessionId: sessionId ?? '',
                        }));

                    if (injectedPages.length > 0) {
                        await NotesRepository.addPagesBulk(injectedPages);
                    }
                }
            }
        }

        if (note) {
            setSelectedNote(note);
            const savedPages = await NotesRepository.getPagesByNoteId(note.id);
            setPages([...savedPages]);

            const activePage = savedPages.find((p: Page) => p.isActive);
            if (activePage) setSelectedPage(activePage);
        }
    }

    // --- REUSABLE UPLOAD HANDLER ---
    // Logika upload diekstrak kesini agar tidak duplikat
    const processSingleFileUpload = async (
        fileToUpload: File,
        tempPageId: string,
        noteContext: Note,
        user: any,
        pageNum: number
    ) => {
        try {
            const result = await uploadFileToGCS(
                fileToUpload,
                {
                    onProgress: (p: UploadProgress) => {
                        setPages(prev => prev.map(page => page.id === tempPageId
                            ? { ...page, uploadProgress: p.percentage, isSaving: true }
                            : page
                        ));
                    },
                },
                {
                    pageId: tempPageId,
                    workspaceId: workspaceId,
                    learningSessionId: sessionId ?? '',
                }
            );

            const newPage = await createPage(noteContext, {
                id: tempPageId,
                title: fileToUpload.name ?? 'Untitled Page',
                pageNum: pageNum,
                workspaceId: noteContext.workspaceId,
                workspaceNoteId: noteContext.id,
                isActive: true,
                status: 'draft',
                processingStatus: 'pending',
                createdAt: new Date().toISOString(),
                learningSessionId: sessionId ?? '',
                syncedId: generateUUID(),
                syncedAt: new Date().toISOString(),
            });

            const filePayload = {
                user_id: user.id,
                disk: 'gcs/atlafiles',
                file_type: getFileTypePure(fileToUpload.type),
                mime_type: result.contentType,
                original_filename: fileToUpload.name,
                size_bytes: result.size,
                created_at: result.timeCreated,
                updated_at: result.updated,
                checksum_sha256: result.md5Hash,
                path: result.name,
                media_link: result.mediaLink
            };

            // BUG FIX: Tambahkan validasi error Supabase
            const { data: fileData, error: fileError } = await supabase.from("files").insert(filePayload).select('*').single();
            if (fileError || !fileData) throw new Error(`Files DB Error: ${fileError?.message}`);

            const attachmentPayload = {
                file_id: fileData.id,
                user_id: user.id,
                entity_type: 'workspace_notes_pages',
                entity_id: newPage.id,
                purpose: 'captured_notebook',
            }

            const { data: attachmentData, error: attachmentError } = await supabase.from("attachments").insert(attachmentPayload).select('*').single();
            if (attachmentError || !attachmentData) throw new Error(`Attachments DB Error: ${attachmentError?.message}`);

            const attributes = { file: fileData, attachment: attachmentData };

            await NotesRepository.microUpdatePage(newPage.id as string, {
                attributes: attributes,
                workspaceNoteId: noteContext.id,
            });

            setPages(prev => prev.map(page => page.id === tempPageId ? {
                ...page,
                id: tempPageId,
                workspaceNoteId: noteContext.id,
                syncedId: newPage.syncedId ?? generateUUID(),
                syncedAt: newPage.syncedAt ?? new Date().toISOString(),
                pageNum: pageNum,
                uploadProgress: null,
                isSaving: false,
                attributes: attributes,
                status: 'draft',
                processingStatus: 'pending',
                isActive: true,
            } : { ...page, isActive: false }));

        } catch (err) {
            console.error(`Failed to process file "${fileToUpload.name}"`, err);
            presentToast({ message: `Gagal mengunggah "${fileToUpload.name}".`, duration: 2500, color: 'danger' });

            setPages(prev => prev.map(page => page.id === tempPageId ? {
                ...page,
                uploadProgress: null,
                uploadError: true,
                isSaving: false,
                isActive: true,
            } : { ...page, isActive: false }));
        }
    };

    // Helper untuk menginisialisasi note jika belum ada
    const ensureNoteActive = async (): Promise<Note | null> => {
        if (!workspaceId) return null;
        if (selectedNote) return selectedNote;

        const newNote = await initNote(workspaceId, sessionId);
        if (!noteId) handleUpdateUrlWithNoteId(newNote.id);
        setSelectedNote(newNote);
        return newNote;
    };

    // --- CAPTURE IMAGE FUNCTION ---
    const handleImageCaptured = async (photo: Photo) => {
        if (!selectedPage || !photo || !photo.webPath || !workspaceId) return;

        const existingPageCount = pages.length;

        ionContentRef.current?.scrollToBottom(0);
        const user = await getUser();
        const activeNote = await ensureNoteActive();
        if (!activeNote) return;

        try {
            const response = await fetch(photo.webPath);
            const blob = await response.blob();
            const fileName = new URL(photo.webPath).pathname.split('/').pop() || 'image.png';
            const pickedFile = new File([blob], fileName, { type: blob.type });
            const pageNum = existingPageCount + 1;

            const tempEntryId = generateUUID();
            const tempEntry = {
                id: tempEntryId,
                title: pickedFile.name,
                uploadProgress: 0,
                uploadError: false,
                userId: user.id,
                workspaceId,
                learningSessionId: sessionId ?? '',
            } as FilePage;

            setPages(prev => [...prev, tempEntry]);

            const file = await pickedFileToFile({
                blob: pickedFile,
                mimeType: blob.type,
                name: fileName,
                size: blob.size,
            });

            await processSingleFileUpload(file, tempEntryId, activeNote, user, pageNum);

        } catch (err) {
            console.error('Image capture pre-processing error:', err);
            presentToast({ message: `Gagal memproses gambar dari kamera.`, duration: 2500, color: 'danger' });
        }
    };

    // --- SELECT MULTIPLE FILES FUNCTION ---
    const selectFile = async () => {
        if (!workspaceId) return;

        let result;
        try {
            result = await FilePicker.pickImages();
        } catch (err) {
            console.error('Failed to open file picker', err);
            return;
        }

        if (!result.files.length) return;
        ionContentRef.current?.scrollToBottom(0);

        const existingPageCount = pages.length;
        const user = await getUser();
        const activeNote = await ensureNoteActive();
        if (!activeNote) return;

        const tempEntries = result.files.map(file => ({
            id: generateUUID(),
            title: file.name,
            uploadProgress: 0,
            uploadError: false,
            userId: user.id,
            workspaceId,
            learningSessionId: sessionId ?? '',
        } as FilePage));

        setPages(prev => [...prev, ...tempEntries]);

        for (let i = 0; i < result.files.length; i++) {
            try {
                const pickedFile = result.files[i];
                const file = await pickedFileToFile(pickedFile);
                const pageNum = existingPageCount + i + 1;
                await processSingleFileUpload(file, tempEntries[i].id as string, activeNote, user, pageNum);
            } catch (err) {
                console.error('File pick pre-processing error:', err);
            }
        }
    };

    const handleSaveChanges = async () => {
        if (!selectedNoteRef?.current?.id) return;
        const user = await getUser();

        // update note dari 'draft' ke 'publish'
        // tujuannya untuk start embedding
        const res = await NotesRepository.upsertNote({
            id: selectedNoteRef.current.id || generateUUID(),
            userId: user.id,
            status: 'published',
            processingStatus: 'pending',
            contentType: 'canvas',
            noteDatetime: sessionData?.ended_at ? sessionData?.ended_at : new Date().toISOString(),
            createdAt: new Date().toISOString(),
            // Canvas tidak punya representasi teks polos seperti Quill —
            // pertahankan content yang sudah ada (biasanya kosong).
            content: selectedNoteRef.current?.content ?? '',
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
            presentToast('Note saved successfully!', 1000);
        }
    }

    const handleError = (error: any) => {
        console.error(error);
        presentToast('Processing error, please try again.', 2500);
    }

    return (
        <IonPage>
            <IonHeader className='ion-no-border'>
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

            <IonContent ref={ionContentRef} className="ion-padding" color={'light'}>
                <div className="w-full sm:w-12/12 md:w-10/12 lg:w-7/12 xl:w-5/12 mx-auto h-full">
                    {pages.length === 0 && (
                        <div className='flex flex-col items-center justify-center h-full ion-padding'>
                            <IonIcon icon={albumsOutline} className="text-4xl mb-2"></IonIcon>
                            <IonText className="text-sm text-center w-2/3 mx-auto" color={'medium'}>
                                No files uploaded yet. Tap button to upload a file.
                            </IonText>
                        </div>
                    )}

                    {pages.length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
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
                                                    <div className="text-neutral-700 flex items-center font-semibold">
                                                        <IonIcon className='text-sm text-neutral-400 mr-1' icon={documentText} />
                                                        <IonText className="text-sm">{page.pageNum}</IonText>
                                                    </div>
                                                    <div className="flex items-center justify-end flex-1">
                                                        <IonButton
                                                            fill="clear"
                                                            mode="ios"
                                                            color="primary"
                                                            size="small"
                                                            disabled={isProcessed}
                                                            onClick={async () => {
                                                                setSelectedPage(page);
                                                                setShowRemoveAlert(true)
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
                </div>
            </IonContent>

            {!isProcessed && (
                <IonFooter className="w-full py-3 ion-no-border bg-[#f4f5f8]">
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
                                            color={'white'}
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
                                                color={'white'}
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

                            // update active index
                            const withActivePages = pages.map((p) => ({ ...p, isActive: p.id === selectedPage.id }));
                            let activeIndex = withActivePages.findIndex(p => p.id === selectedPage.id);
                            if (activeIndex === -1) {
                                activeIndex = withActivePages.findIndex((p) => p.isActive);
                            }

                            // delete page from db
                            await NotesRepository.deletePage({
                                pageId: withActivePages[activeIndex].id,
                                workspaceId: withActivePages[activeIndex].workspaceId,
                                workspaceNoteId: withActivePages[activeIndex].workspaceNoteId,
                                learningSessionId: withActivePages[activeIndex].learningSessionId,
                                syncToServer: true,
                            });

                            const filtered = withActivePages.filter((_, idx) => idx !== activeIndex);

                            // tidak ada page tersisa -> clear canvas
                            if (filtered.length === 0) {
                                setPages([]);

                                // hapus note nya juga
                                if (selectedPage.workspaceNoteId && selectedPage.workspaceId && selectedPage.learningSessionId) {
                                    await NotesRepository.deleteNote(
                                        selectedPage.workspaceNoteId,
                                        selectedPage.workspaceId,
                                        selectedPage.learningSessionId,
                                        true,
                                    );

                                    // redirect ke halaman workspace
                                    if (ionRouter.canGoBack()) {
                                        ionRouter.goBack();
                                    } else {
                                        ionRouter.push(`dashboard/workspace/${selectedPage.workspaceId}/sessions/${selectedPage.learningSessionId}`, 'none', 'replace');
                                    }
                                }
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
            <IonModal
                isOpen={!!viewImage}
                onDidDismiss={() => setViewImage(null)}
                className='rounded-2xl'
            >
                <IonHeader className="ion-no-border">
                    <IonToolbar color={'light'} className='borderless'>
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