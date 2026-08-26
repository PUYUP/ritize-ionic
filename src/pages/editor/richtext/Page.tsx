import './Page.css';
import {
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonPage,
    IonSpinner,
    IonToolbar,
    useIonToast,
    useIonViewWillLeave,
} from '@ionic/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type Quill from 'quill';
import type { Delta } from 'quill';
import QuillEditor, { type ImageUploadHandler } from '../components/QuillEditor';

const AUTOSAVE_DELAY_MS = 1500;

const RichTextEditorPage: React.FC = () => {
    const quillRef = useRef<Quill | null>(null);
    const autosaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const [isDirty, setIsDirty] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [presentToast] = useIonToast();

    // TODO: load real content (API call, Capacitor Preferences, IndexedDB…)
    const [initialContent] = useState<Delta | undefined>(undefined);

    const persist = useCallback(async () => {
        const quill = quillRef.current;
        if (!quill) return;
        setIsSaving(true);
        try {
            const delta = quill.getContents(); // lossless — prefer this over HTML for storage
            // const html = quill.root.innerHTML; // use only if you need to render outside Quill
            // TODO: send `delta` to your backend/storage here.
            console.log('saving', delta);
            setIsDirty(false);
        } catch (err) {
            console.error('Failed to save document', err);
            presentToast({ message: 'Could not save your changes.', duration: 2500, color: 'danger' });
        } finally {
            setIsSaving(false);
        }
    }, [presentToast]);

    const handleTextChange = useCallback(() => {
        setIsDirty(true);
        if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
        autosaveTimer.current = setTimeout(persist, AUTOSAVE_DELAY_MS);
    }, [persist]);

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

    return (
        <IonPage>
            <IonHeader className="ion-no-border">
                <IonToolbar className="fixed" style={{ '--min-height': '36px', top: '10px' }}>
                    <IonButtons slot="start" className="ion-padding-start">
                        <IonBackButton defaultHref="/" />
                    </IonButtons>
                    <IonButtons slot="end" className="ion-padding-end">
                        <IonButton onClick={persist} disabled={!isDirty || isSaving} strong>
                            {isSaving ? <IonSpinner name="dots" /> : 'Save'}
                        </IonButton>
                    </IonButtons>
                </IonToolbar>
            </IonHeader>
            <IonContent>
                <QuillEditor
                    ref={quillRef}
                    defaultValue={initialContent}
                    placeholder="Start writing…"
                    onTextChange={handleTextChange}
                    onImageUpload={handleImageUpload}
                    className="quill-editor-container"
                />
            </IonContent>
        </IonPage>
    );
};

export default RichTextEditorPage;