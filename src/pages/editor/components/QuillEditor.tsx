import React, { forwardRef, useEffect, useLayoutEffect, useRef } from 'react';
import Quill, { Delta, Range as QuillRange, type QuillOptions, type EmitterSource } from 'quill';
import 'quill/dist/quill.snow.css';
import './QuillEditor.css';

export type ImageUploadHandler = (file: File) => Promise<string>;

export interface QuillEditorProps {
    readOnly?: boolean;
    defaultValue?: Delta;
    placeholder?: string;
    toolbarOptions?: unknown[];
    onTextChange?: (delta: Delta, oldDelta: Delta, source: EmitterSource) => void;
    onSelectionChange?: (range: QuillRange | null, oldRange: QuillRange | null, source: EmitterSource) => void;
    /** If omitted, falls back to Quill's default (base64-embedded) image handling. */
    onImageUpload?: ImageUploadHandler;
    className?: string;
}

const DEFAULT_TOOLBAR = [
    [{ header: [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ color: [] }, { background: [] }],
    [{ list: 'ordered' }, { list: 'bullet' }],
    [{ indent: '-1' }, { indent: '+1' }],
    [{ align: [] }],
    ['blockquote', 'code-block'],
    ['link', 'image'],
    ['clean'],
];

function setRef<T>(ref: React.ForwardedRef<T>, value: T | null) {
    if (typeof ref === 'function') ref(value);
    else if (ref) (ref as React.MutableRefObject<T | null>).current = value;
}

const QuillEditor = forwardRef<Quill, QuillEditorProps>(
    (
        {
            readOnly = false,
            defaultValue,
            placeholder = 'Write something…',
            toolbarOptions = DEFAULT_TOOLBAR,
            onTextChange,
            onSelectionChange,
            onImageUpload,
            className,
        },
        ref
    ) => {
        const containerRef = useRef<HTMLDivElement | null>(null);

        // Config captured once at init time (changing these mid-session would
        // require tearing the editor down, which we deliberately avoid).
        const defaultValueRef = useRef(defaultValue);
        const onImageUploadRef = useRef(onImageUpload);

        // Callbacks re-synced every render via refs, so the init effect below
        // can stay dependency-free without going stale.
        const onTextChangeRef = useRef(onTextChange);
        const onSelectionChangeRef = useRef(onSelectionChange);
        useLayoutEffect(() => {
            onTextChangeRef.current = onTextChange;
            onSelectionChangeRef.current = onSelectionChange;
        });

        // Toggle read-only without recreating the instance.
        useEffect(() => {
            const quill = (ref as React.MutableRefObject<Quill | null> | null)?.current;
            quill?.enable(!readOnly);
        }, [ref, readOnly]);

        useEffect(() => {
            const container = containerRef.current;
            if (!container) return;

            // Quill takes ownership of this element's DOM (adds toolbar sibling,
            // wraps content in .ql-editor, etc). Giving it a child element instead
            // of `container` itself keeps React from ever touching that subtree.
            const editorEl = container.appendChild(container.ownerDocument.createElement('div'));

            const toolbarModule: Record<string, unknown> = { container: toolbarOptions };
            if (onImageUploadRef.current) {
                toolbarModule.handlers = {
                    image: function imageHandler(this: { quill: Quill }) {
                        const input = document.createElement('input');
                        input.setAttribute('type', 'file');
                        input.setAttribute('accept', 'image/*');
                        input.click();
                        input.onchange = async () => {
                            const file = input.files?.[0];
                            const upload = onImageUploadRef.current;
                            if (!file || !upload) return;
                            const range = this.quill.getSelection(true);
                            try {
                                const url = await upload(file);
                                const index = range?.index ?? this.quill.getLength();
                                this.quill.insertEmbed(index, 'image', url, 'user');
                                this.quill.setSelection(index + 1, 0, 'silent');
                            } catch (err) {
                                console.error('Image upload failed', err);
                            }
                        };
                    },
                };
            }

            const options: QuillOptions = {
                theme: 'snow',
                placeholder,
                readOnly,
                modules: { toolbar: toolbarModule },
            };

            const quill = new Quill(editorEl, options);
            setRef(ref, quill);

            if (defaultValueRef.current) {
                quill.setContents(defaultValueRef.current, 'silent');
            }

            const handleTextChange = (delta: Delta, oldDelta: Delta, source: EmitterSource) => {
                onTextChangeRef.current?.(delta, oldDelta, source);
            };
            const handleSelectionChange = (
                range: QuillRange | null,
                oldRange: QuillRange | null,
                source: EmitterSource
            ) => {
                onSelectionChangeRef.current?.(range, oldRange, source);
            };

            quill.on('text-change', handleTextChange);
            quill.on('selection-change', handleSelectionChange);

            return () => {
                quill.off('text-change', handleTextChange);
                quill.off('selection-change', handleSelectionChange);
                setRef(ref, null);
                container.innerHTML = ''; // full teardown — safe under StrictMode's mount/unmount/remount
            };
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, []);

        return <div ref={containerRef} className={className} aria-label={placeholder} />;
    }
);

QuillEditor.displayName = 'QuillEditor';

export default QuillEditor;