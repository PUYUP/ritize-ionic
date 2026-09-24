import {
	IonAlert,
	IonBackButton,
	IonButton,
	IonButtons,
	IonContent,
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
import { Excalidraw, exportToBlob, MainMenu, serializeAsJSON } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import './Page.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { checkmarkCircleOutline, copyOutline, duplicateOutline, trashOutline } from 'ionicons/icons';
import { useDeviceWidth } from '../../../../utils/sizing';
import { menuController } from '@ionic/core/components';

import Swiper from 'swiper';
import { FreeMode, Mousewheel } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/free-mode';
import { AppState, BinaryFiles, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { Note, Page } from '../../../../databases/entities/notes';
import NotesRepository from '../../../../databases/datasources/NotesRepository';
import { useSearchParams } from 'react-router-dom';
import { NoteFormatTypes, NotePageTypes, useLazyGetNoteByIdQuery } from '../../../../services/notes';
import { useGetWorkspaceByIdQuery } from '../../../../services/workspace';
import { blobToBase64, generateUUID } from '../../../../utils/generator';
import { getUser } from '../../../../utils/authState';
import { useGetLearningSessionByIdQuery } from '../../../../services/learning.session';

const AUTOSAVE_THROTTLE_MS = 500;
const DEBOUNCE_DELAY = 300;

/**
 * A scene is "empty" only if it has no visible (non-deleted) elements.
 * Mirrors isDeltaEmpty() in the text editor: we only want to write
 * contentData: null when there's truly nothing worth keeping.
 */
function isElementsEmpty(elements: readonly ExcalidrawElement[] | null | undefined): boolean {
	if (!elements || elements.length === 0) return true;
	return !elements.some((el) => !el.isDeleted);
}

function getElementFingerprint(el: ExcalidrawElement) {
	// Buang properti meta yang tidak relevan dengan tampilan visual
	const { version, versionNonce, updated, seed, isDeleted, ...coreProperties } = el;
	return JSON.stringify(coreProperties);
}

const CanvasEditorPage: React.FC = () => {
	const [searchParams, setSearchParams] = useSearchParams();
	const workspaceId = searchParams.get('workspaceId');
	const noteId = searchParams.get('noteId');
	const sessionId = searchParams.get('sessionId');
	const pageId = searchParams.get('pageId');
	const isProcessed = Boolean(searchParams.get('clusteredDate'));

	const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null);
	const [isLoaded, setIsLoaded] = useState(false);
	const isDirtyRef = useRef(false);
	const [isSaving, setIsSaving] = useState(false);
	const [hasContent, setHasContent] = useState(false);
	const [pages, setPages] = useState<Page[]>([]);
	const [showClearAlert, setShowClearAlert] = useState(false);
	const [showRemoveAlert, setShowRemoveAlert] = useState(false);
	const [presentToast] = useIonToast();

	const [selectedNote, setSelectedNote] = useState<Note | null>(null);
	const [selectedPage, setSelectedPage] = useState<Partial<Page> | null>(null);

	const wrapperRef = useRef<HTMLDivElement>(null);
	const autosaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
	// Tracks the JSON we last wrote to the DB for the active page, so a
	// no-op autosave (e.g. triggered right after loading content into the
	// canvas) can be skipped instead of writing an identical row again.
	const lastSavedDataRef = useRef<string | null>(null);
	// Menyimpan backup data Excalidraw secara real-time
	const latestCanvasStateRef = useRef<{
		elements: readonly ExcalidrawElement[];
		appState: AppState;
		files: BinaryFiles;
	} | null>(null);

	// Menyimpan halaman yang sedang aktif agar tidak menjadi null saat unmount
	const selectedPageRef = useRef<Partial<Page> | null>(null);
	const selectedNoteRef = useRef<Partial<Note> | null>(null);
	const selectedSessionRef = useRef<{ id: string } | null>(null);

	const width = useDeviceWidth();

	const pagesSwiperElRef = useRef<HTMLDivElement>(null);
	const pagesSwiperRef = useRef<Swiper | null>(null);
	const prevPagesLengthRef = useRef(pages.length);
	const prevNoteIdRef = useRef<string | null>(searchParams.get('noteId'));
	const isPageActiveRef = useRef(true);
	const isDeletedRef = useRef(false);

	// Throttle bookkeeping: kapan terakhir kali benar-benar save, dan
	// apakah ada save yang masih berjalan (mencegah dua write bertabrakan
	// untuk page yang sama saat user mengetik cepat).
	const lastPersistedAtRef = useRef(0);
	const isSavingRef = useRef(false);
	const isProgrammaticUpdateRef = useRef(true);
	// Ref untuk menyimpan timer debounce
	const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Sumber kebenaran baseline: elements terakhir yang KITA TAHU sama dengan
	// server. HANYA ditulis di contentLoader (saat load awal / page baru)
	// dan handleSaveChanges (setelah sync berhasil). Effect yang me-load
	// konten ke kanvas cuma BACA ini, gak pernah nulis — supaya gak sirkular
	// kayak sebelumnya.
	const serverBaselineRef = useRef<Record<string, { elements: ExcalidrawElement[] | null; length: number }>>({});

	const setServerBaseline = useCallback((pageId: string, elements: ExcalidrawElement[] | null, length: number) => {
		serverBaselineRef.current[pageId] = { elements, length };
	}, []);

	// RTK Query
	const [getNoteById] = useLazyGetNoteByIdQuery();
	const { data: workspaceData } = useGetWorkspaceByIdQuery(workspaceId ?? "", { skip: !workspaceId });
	const { data: sessionData } = useGetLearningSessionByIdQuery(sessionId ?? "", { skip: !sessionId });

	const updateIsDirty = useCallback((value: boolean) => {
		isDirtyRef.current = value;
	}, []);

	// Gunakan useRef untuk menyimpan state awal tanpa memicu re-render
	const initialElementsMap = useRef<Map<string, string>>(new Map());
	const initialActiveCount = useRef<number>(0);

	// State untuk UI (opsional: jika Anda ingin menampilkan status di layar)
	const [hasSignificantChange, setHasSignificantChange] = useState(false);

	// excalidraw setups
	const excalidrawAppProps = useMemo(() => ({
		appState: {
			currentItemStrokeWidth: 0.5,
			currentItemStrokeColor: '#1e1e1e',
			gridStep: width, // Pastikan 'width' masuk ke dependency array di bawah
			activeTool: {
				type: 'freedraw' as const,
				customType: null,
				locked: false,
				lastActiveTool: null,
				fromSelection: false,
			},
			penMode: false,
		} as any
	}), [width]); // <-- re-create hanya jika width layar berubah

	const handleUpdateUrlWithNoteId = (newNoteId: string) => {
		prevNoteIdRef.current = newNoteId;
		const newParams = new URLSearchParams(searchParams);
		newParams.set('noteId', newNoteId);
		setSearchParams(newParams, { replace: true });
	};

	// Saves an explicit (page, elements/appState/files) triple. Takes them
	// as arguments rather than reading live from excalidrawAPI at call
	// time, so callers control exactly what gets written where — this is
	// what makes it safe to call right before switching pages (see
	// flushPendingSave / persistCurrentPage).
	const persistPageContent = useCallback(async (
		page: Partial<Page>,
		elements: readonly ExcalidrawElement[],
		appState: AppState,
		files: BinaryFiles,
	) => {
		isSavingRef.current = true;
		// Hanya update state UI jika halaman masih aktif
		if (isPageActiveRef.current) setIsSaving(true);
		try {
			const contentEmpty = isElementsEmpty(elements);
			const json = contentEmpty ? null : serializeAsJSON(elements, appState, files, 'local');

			// Identical to the last thing we saved (typically a save
			// triggered right after a programmatic updateScene, not a real
			// edit) — skip the redundant DB write.
			if (json === lastSavedDataRef.current) return;
			lastSavedDataRef.current = json;

			const bufferData = json ? Buffer.from(json, 'utf-8') : null;
			let fileData = null;

			if (!contentEmpty) {
				// extract as image
				const blobData = await exportToBlob({
					elements: elements,
					appState: { exportBackground: true },
					mimeType: "image/png",
				});

				fileData = await blobToBase64(blobData);
			}

			const currentStatus = selectedNoteRef.current?.status;
			const isDraft = currentStatus === 'draft';

			await NotesRepository.microUpdatePage(page.id as string, {
				id: page.id,
				userId: page.userId,
				workspaceId: page.workspaceId,
				workspaceNoteId: page.workspaceNoteId,
				learningSessionId: page.learningSessionId,
				contentData: bufferData,
				contentExtracted: { fileData: fileData },

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
				setPages((prevPages) =>
					prevPages.map((p) => (p.id === page.id ? {
						...p,
						contentData: bufferData,
						contentExtracted: { fileData: fileData },
						status: isDraft
							? 'draft'
							: (hasSignificantChange ? 'draft' : 'published'),
						processingStatus: isDraft
							? 'pending'
							: (hasSignificantChange ? 'pending' : 'processed'),
					} : p))
				);
			}
		} catch (err) {
			console.error('Failed to save canvas', err);
			// Cegah update state jika halaman sudah di-reset oleh useIonViewDidLeave
			if (isPageActiveRef.current) {
				presentToast({ message: 'Could not save your changes.', duration: 2500, color: 'danger' });
			}
		} finally {
			isSavingRef.current = false;
			// Cegah update state jika halaman sudah di-reset oleh useIonViewDidLeave
			if (isPageActiveRef.current) setIsSaving(false);
		}
	}, [presentToast, workspaceId, selectedNote, hasSignificantChange]);

	// Persists whatever is currently on the canvas for the currently
	// selected page.
	const persistCurrentPage = useCallback(async () => {
		// Ambil data dari Ref, bukan dari state yang mungkin sudah hilang
		const page = selectedPageRef.current;
		const note = selectedNoteRef.current;
		const canvasData = latestCanvasStateRef.current;

		if (!canvasData || !page || !note || isProcessed) return;

		const { elements, appState, files } = canvasData;

		// Eksekusi API secara asynchronous
		await persistPageContent(page, elements, appState, files);

		// Set false agar tidak terpicu dua kali
		updateIsDirty(false);
	}, [isProcessed, persistPageContent, updateIsDirty]);

	// Cancels any pending debounced autosave and, if there are unsaved
	// changes, saves them immediately for the CURRENT page.
	//
	// This must be awaited before switching pages, adding a page, or
	// leaving the editor. Without it, a pending autosave (scheduled while
	// page A was active) can fire after page B's content has already been
	// swapped into the canvas, saving page B's content under page A's id.
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
	}, [isDirtyRef, persistCurrentPage]);

	// ...
	// realtime content changed in the canvas
	// ...
	const handleSceneChange = useCallback((
		elements: readonly ExcalidrawElement[],
		appState: AppState,
		files: BinaryFiles
	) => {
		const visibleElements = elements.filter((el) => !el.isDeleted);
		setHasContent(visibleElements.length > 0);

		// NOTE: tidak ada early-return di sini kalau kanvas kosong. Kalau
		// user menghapus semua elemen, itu tetap harus ter-autosave (sama
		// seperti handleTextChange di editor teks membiarkan isDeltaEmpty
		// menentukan apakah ditulis null, bukan skip prosesnya sama sekali).

		updateIsDirty(true);

		// Simpan state terbaru ke Ref untuk backup
		latestCanvasStateRef.current = { elements, appState, files };

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
	}, [updateIsDirty, persistCurrentPage]); // Pastikan dependencies sesuai

	// Ionic's router outlet keeps pages mounted in its history stack, so plain
	// unmount isn't a reliable "user is leaving" signal — flush explicitly.
	useIonViewWillEnter(() => {
		isPageActiveRef.current = true;
	});

	useIonViewWillLeave(() => {
		isPageActiveRef.current = false;
		isProgrammaticUpdateRef.current = false;
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
		isProgrammaticUpdateRef.current = false;
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

	useEffect(() => {
		menuController.swipeGesture(false);
		return () => {
			menuController.swipeGesture(true);
		};
	}, []);

	// add custom button
	useEffect(() => {
		if (!isLoaded || !wrapperRef.current) return;

		setTimeout(() => {
			const mobileToolbarDiv = wrapperRef.current?.querySelector(
				'.App-bottom-bar .mobile-toolbar'
			) as HTMLElement | null;

			if (mobileToolbarDiv) {
				const originalGetBoundingClientRect = mobileToolbarDiv.getBoundingClientRect.bind(mobileToolbarDiv);

				mobileToolbarDiv.getBoundingClientRect = () => {
					const rect = originalGetBoundingClientRect();
					const extra = 200;
					const w = rect.width + extra;

					const patched: DOMRect = {
						x: rect.x,
						y: rect.y,
						width: w,
						height: rect.height,
						top: rect.top,
						left: rect.left,
						right: rect.left + w,
						bottom: rect.bottom,
						toJSON() {
							return {
								x: this.x, y: this.y, width: this.width, height: this.height,
								top: this.top, right: this.right, bottom: this.bottom, left: this.left
							};
						},
					};

					return patched;
				};

				window.dispatchEvent(new Event('resize'));
			}
		}, 100);
	}, [isLoaded]);

	// Initialize the pages Swiper once and clean it up on unmount.
	useEffect(() => {
		const containerEl = pagesSwiperElRef.current;
		if (!containerEl) return;

		pagesSwiperRef.current = new Swiper(containerEl, {
			modules: [FreeMode, Mousewheel],
			direction: 'horizontal',
			slidesPerView: 'auto',
			spaceBetween: 6,
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

	// Load content data for the active page into the canvas.
	useEffect(() => {
		if (!excalidrawAPI || !selectedPage?.id) return;
		const pageId = selectedPage.id;

		const loadContentData = async () => {
			const contentData = selectedPage?.contentData;

			// Halaman baru dibuka — biarkan edit pertama user langsung
			// tersimpan, jangan mewarisi window throttle halaman sebelumnya.
			lastPersistedAtRef.current = 0;

			// Jaga-jaga kalau caller lupa flush: batalkan autosave timer
			// yang mungkin masih nyantol dari halaman SEBELUMNYA.
			if (autosaveTimer.current) {
				clearTimeout(autosaveTimer.current);
				autosaveTimer.current = undefined;
			}

			// Redam onChange sampai transisi kanvas benar-benar settle,
			// supaya onChange yang masih membawa elements halaman LAMA
			// (karena updateScene di bawah baru jalan 100ms lagi) tidak
			// ikut ter-treat sebagai perubahan milik halaman BARU ini.
			isProgrammaticUpdateRef.current = false;
			latestCanvasStateRef.current = null;

			let loadedElements: ExcalidrawElement[] = [];

			if (contentData) {
				try {
					const decoder = new TextDecoder('utf-8');
					const jsonString = decoder.decode(contentData);

					if (!jsonString) return;

					const json = JSON.parse(jsonString);
					loadedElements = json.elements ?? [];

					setHasContent(!isElementsEmpty(loadedElements));
					lastSavedDataRef.current = jsonString;

					setTimeout(() => {
						// Restore file/image binernya dulu sebelum elements
						// di-render, supaya gambar yang sudah pernah
						// ditempel di kanvas tidak hilang saat reload.
						if (json.files && excalidrawAPI.addFiles) {
							try {
								excalidrawAPI.addFiles(Object.values(json.files));
							} catch (fileErr) {
								console.error('Failed to restore embedded files', fileErr);
							}
						}

						excalidrawAPI.updateScene({
							elements: loadedElements,
							appState: {
								...json.appState,
								...excalidrawAppProps.appState,
							},
						});
					}, 100);
				} catch (error) {
					console.error('Failed to parse saved content', error);
					loadedElements = [];
					setHasContent(false);
					lastSavedDataRef.current = null;
				}
			} else {
				loadedElements = [];
				setHasContent(false);
				lastSavedDataRef.current = null;

				setTimeout(() => {
					excalidrawAPI.updateScene({
						elements: [],
						appState: excalidrawAppProps.appState,
					});
				}, 100);
			}

			// BACA saja. Fallback di sini cuma jaga-jaga kalau ada bug di
			// contentLoader yang bikin baseline belum ke-set — jalur normal
			// seharusnya selalu ketemu.
			const baseline = serverBaselineRef.current[pageId] ?? { elements: loadedElements, length: loadedElements.length };
			setInitialState(baseline.elements ?? []);

			// Dihitung ULANG tiap revisit, dari baseline yang gak pernah
			// bergeser — bukan di-reset ke false.
			setHasSignificantChange(checkNetChange(loadedElements));
		};

		loadContentData();
	}, [selectedPage, excalidrawAPI]);

	useEffect(() => {
		const handleVisibilityChange = () => {
			// Check if the document visibility state is 'visible'
			if (document.visibilityState == 'visible') {
				isProgrammaticUpdateRef.current = true;
			}
		};

		// Add listener for tab switching/minimizing
		document.addEventListener('visibilitychange', handleVisibilityChange);

		// Cleanup the listener when the component unmounts
		return () => {
			document.removeEventListener('visibilitychange', handleVisibilityChange);
		};
	}, []);

	// select page
	const selectPageHandler = async (page: Page) => {
		if (!selectedNoteRef.current?.id || !selectedPageRef.current?.id) return;
		if (selectedPageRef.current?.id === page.id) return;

		try {
			// Flush any unsaved edits on the OUTGOING page before touching
			// selectedPage / swapping the canvas' content.
			await flushPendingSave();

			const updatedPages = pages.map((p) => ({ ...p, isActive: p.id === page.id }));
			await NotesRepository.updatePagesBulk(updatedPages, false);

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
			await flushPendingSave();

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
			noteDatetime: sessionData?.ended_at ? sessionData?.ended_at : new Date().toISOString(),
			createdAt: new Date().toISOString(),
			contentType: "canvas",
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
		setServerBaseline(entity.id, [], 1);
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
				const { data: serverNote } = await getNoteById({ id: noteId });
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
							const parsed = JSON.parse(decoder.decode(x));
							const elements: ExcalidrawElement[] = parsed?.elements ?? [];
							setServerBaseline(p.id, elements, elements.length);
						} catch (err) {
							console.error('Failed to set baseline for page', p.id, err);
							setServerBaseline(p.id, [], 1);
						}
					} else {
						setServerBaseline(p.id, [], 1);
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
						noteDatetime: serverNote.note_datetime ? serverNote.note_datetime : new Date().toISOString(),
						contentType: serverNote.content_type as NoteFormatTypes,
						syncedId: serverNote.synced_id ? serverNote.synced_id : newSyncedId,
						syncedAt: serverNote.synced_at ? serverNote.synced_at : new Date().toISOString(),
						createdAt: serverNote.created_at ? serverNote.created_at : new Date().toISOString(),
						learningSessionId: sessionId ? sessionId : '',
					}

					note = await NotesRepository.insertNote(nData, false);
					console.log('injected note', note);

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
									syncedAt: p.synced_at ? p.synced_at : new Date().toISOString(),
									createdAt: p.created_at ? p.created_at : new Date().toISOString(),
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
						// di local db
						const page = await createPage({ id: note.id }, {
							id: generateUUID(),
							pageNum: 1,
							workspaceId: workspaceId,
							workspaceNoteId: note.id,
							isActive: true,
							status: 'draft',
							processingStatus: 'pending',
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
			const unsyncedNote = await NotesRepository.getUnsyncedNote('canvas', sessionId ?? '');
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

			// aktifkan page jika pageId ada di url args
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
						const parsed = JSON.parse(decoder.decode(p.contentData));
						const elements: ExcalidrawElement[] = parsed?.elements ?? [];
						setServerBaseline(p.id, elements, elements.length);
					} catch (e) {
						console.error('Failed to set baseline for page', p.id, e);
						setServerBaseline(p.id, [], 1);
					}
				} else {
					setServerBaseline(p.id, [], 1);
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

	// Reset state & canvas saat berpindah antar note (mengatasi isu cache/stale data)
	useEffect(() => {
		if (prevNoteIdRef.current !== noteId) {

			// 1. SELAMATKAN DATA SEBELUMNYA!
			// Jika kanvas masih kotor (belum disave), paksa save sekarang
			// ke background menggunakan data note yang lama (dari Ref).
			if (isDirtyRef.current) {
				console.log("Menyimpan note lama sebelum berpindah ke note baru...");
				flushPendingSave();
			}

			// 2. Lakukan Reset State
			setPages([]);
			setSelectedPage(null);
			setSelectedNote(null);
			lastSavedDataRef.current = null;

			// 3. Update penanda
			prevNoteIdRef.current = noteId;

			// 4. Bersihkan Kanvas Excalidraw
			if (excalidrawAPI) {
				excalidrawAPI.updateScene({
					elements: [],
					appState: excalidrawAppProps.appState
				});
			}
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [noteId]);

	// ...
	// save changes
	// ...
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

			console.log(updatedPages);

			await NotesRepository.upsertPagesBulk(updatedPages);
			setPages(updatedPages);
			setSelectedNote(res);

			const activePageId = selectedPageRef.current?.id;

			updatedPages.forEach((p) => {
				if (p.id === activePageId) {
					// Halaman aktif: pakai elements yang sekarang PERSIS ada
					// di kanvas — paling akurat, gak perlu decode ulang.
					const liveElements = latestCanvasStateRef.current?.elements
						?? excalidrawAPI?.getSceneElementsIncludingDeleted()
						?? [];
					const snapshot = [...liveElements];
					setServerBaseline(p.id, snapshot, snapshot.length);
					return;
				}
				if (p.contentData) {
					try {
						const decoder = new TextDecoder('utf-8');
						const parsed = JSON.parse(decoder.decode(p.contentData));
						const elements: ExcalidrawElement[] = parsed?.elements ?? [];
						setServerBaseline(p.id, elements, elements.length);
					} catch (e) {
						console.error('Failed to refresh baseline for page', p.id, e);
					}
				} else {
					setServerBaseline(p.id, [], 1);
				}
			});

			if (activePageId) {
				const b = serverBaselineRef.current[activePageId];
				setInitialState(b?.elements ?? []);
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

	// 1. Fungsi untuk merekam kondisi awal (di-wrap dengan useCallback)
	const setInitialState = useCallback((elements: readonly ExcalidrawElement[]) => {
		initialElementsMap.current.clear();
		initialActiveCount.current = 0;

		elements.forEach((el) => {
			if (!el.isDeleted) {
				initialElementsMap.current.set(el.id, getElementFingerprint(el));
				initialActiveCount.current++;
			}
		});
	}, []);

	// 2. Fungsi untuk mengecek perubahan
	const checkNetChange = useCallback((currentElements: readonly ExcalidrawElement[]) => {
		let changeCount = 0;
		const initialMap = initialElementsMap.current;
		const initialCount = initialActiveCount.current;

		// Jika canvas awalnya kosong sama sekali
		if (initialCount === 0) {
			const currentActive = currentElements.filter(el => !el.isDeleted).length;
			return currentActive > 0;
		}

		currentElements.forEach((el) => {
			const initialFingerprint = initialMap.get(el.id);

			if (el.isDeleted) {
				// Elemen bawaan yang dihapus
				if (initialFingerprint !== undefined) {
					changeCount++;
				}
			} else {
				// Elemen baru
				if (initialFingerprint === undefined) {
					changeCount++;
				}
				// Elemen bawaan yang dimodifikasi
				else {
					const currentFingerprint = getElementFingerprint(el);
					if (initialFingerprint !== currentFingerprint) {
						changeCount++;
					}
				}
			}
		});

		const percentageChanged = (changeCount / initialCount) * 100;

		// Opsional: console log untuk debugging
		// console.log(`Perubahan: ${percentageChanged.toFixed(1)}%`);

		return percentageChanged >= 10;
	}, []);

	return (
		<IonPage>
			<IonHeader className="ion-no-border">
				<IonToolbar color={'light'} className='borderless'>
					<IonButtons slot="start" className='ion-padding-start'>
						<IonBackButton defaultHref='/dashboard' />
					</IonButtons>

					<IonTitle className='text-sm ion-padding-start ion-padding-end line-clamp-1'>
						{workspaceData?.title ?? 'Untitled Note'}
					</IonTitle>

					{!isProcessed && (
						<>
							{/* pages tools */}
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

			<IonContent fullscreen scrollY={false}>
				<div
					ref={wrapperRef}
					className='relative'
					style={{
						width: "100%",
						height: "100%",
						touchAction: 'none', // cegah browser native pinch/scroll di area ini
						opacity: isLoaded ? 1 : 0,
						transition: 'opacity 0.2s ease-in-out'
					}}
				>
					<Excalidraw
						autoFocus
						aiEnabled={false}
						onInitialize={(api: ExcalidrawImperativeAPI | null) => {
							isProgrammaticUpdateRef.current = false;
							setExcalidrawAPI(api);
							if (api) setIsLoaded(true);
						}}
						onChange={(elements, appState, files) => {
							if (!excalidrawAPI || isDeletedRef.current) return;

							if (isProgrammaticUpdateRef.current == true) {
								// Cek apakah perubahan sudah mencapai 10%
								const isChanged = checkNetChange(elements);
								setHasSignificantChange(isChanged);
								handleSceneChange(elements, appState, files);
							}

							// implementasi debounce, jika tidak ada update lagi
							// maka initializing selesai
							if (isProgrammaticUpdateRef.current == false) {
								// setiap onChange terpanggil, batalkan timer sebelumnya
								if (debounceTimerRef.current) {
									clearTimeout(debounceTimerRef.current);
								}

								// pasang timer baru; kalau tidak ada onChange lagi dalam
								// DEBOUNCE_DELAY ms, berarti "badai" update sudah reda
								debounceTimerRef.current = setTimeout(() => {
									isProgrammaticUpdateRef.current = true;
									debounceTimerRef.current = null;
								}, DEBOUNCE_DELAY);
							}
						}}
						// onScrollChange={handleScrollChange}
						gridModeEnabled={true}
						zenModeEnabled={true}
						viewModeEnabled={isProcessed}
						UIOptions={{
							// @ts-ignore
							getFormFactor: () => 'phone',
							canvasActions: {
								export: false,
								toggleTheme: false,
								loadScene: false,
								saveAsImage: false,
								saveToActiveFile: false,
								changeViewBackgroundColor: false,
							},
						}}
						renderTopRightUI={() => <></>}
					>
						<MainMenu>
							<MainMenu.DefaultItems.ClearCanvas />
						</MainMenu>
					</Excalidraw>

					<div className='z-50 absolute left-[12px] right-[12px] max-w-[450px] mx-auto'
						style={{ 'top': 'calc(16px + var(--ion-safe-area-top, 0))', 'paddingBottom': 'var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0))' }}
					>
						<div className={`w-full px-[2px] h-[40px] ${!isProcessed && 'bg-white border border-neutral-100 rounded-full shadow'}`}>
							<div className='flex flex-row gap-3 items-center justify-between h-full tool-buttons'>
								<div className='flex-1 overflow-hidden'>
									<div ref={pagesSwiperElRef} className='swiper h-[44px] w-full'>
										<div id="pages-list" className='swiper-wrapper flex flex-row'>
											{pages.map((page) => (
												<div key={page.id} className='swiper-slide !flex items-center !h-auto !w-auto !mb-0'>
													<IonButton
														size='small'
														shape="round"
														fill='clear'
														color={page.isActive ? 'primary' : 'dark'}
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
									<div className='flex flex-row gap-3 justify-center'>
										<IonButton
											size='small'
											shape="round"
											color={'dark'}
											fill='clear'
											disabled={!hasContent || isProcessed}
											onClick={() => setShowClearAlert(true)}
										>
											<IonIcon icon={copyOutline} slot='icon-only'></IonIcon>
										</IonButton>

										<IonButton
											size='small'
											shape="round"
											color={'dark'}
											fill='clear'
											disabled={pages.length <= 1 || !selectedPage || isProcessed}
											onClick={() => setShowRemoveAlert(true)}
										>
											<IonIcon icon={trashOutline} slot='icon-only'></IonIcon>
										</IonButton>

										<IonButton
											size='small'
											shape="round"
											color={'dark'}
											fill='clear'
											onClick={async () => await newPageHandler()}
											disabled={isProcessed}
										>
											<IonIcon icon={duplicateOutline} slot='icon-only'></IonIcon>
										</IonButton>
									</div>
								)}
							</div>
						</div>
					</div>
				</div>
			</IonContent>

			{/* clear canvas alert */}
			<IonAlert
				isOpen={showClearAlert}
				onDidDismiss={() => setShowClearAlert(false)}
				header='Are you sure to clear canvas?'
				message={'All your current notes will be permanently deleted.'}
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

							await excalidrawAPI?.resetScene();
							excalidrawAPI?.updateScene({
								appState: {
									...excalidrawAPI?.getAppState(),
									...excalidrawAppProps.appState,
								},
							});
							setHasContent(false);

							// Persist explicitly instead of relying on the
							// onChange event: the clear is a programmatic
							// update, not a user edit.
							if (selectedPage && excalidrawAPI) {
								await persistPageContent(
									selectedPage,
									[],
									excalidrawAPI.getAppState(),
									excalidrawAPI.getFiles(),
								);
								updateIsDirty(false);
								isProgrammaticUpdateRef.current = true;
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
							if (!selectedPage || !selectedNote) return;
							const activeIndex = pages.findIndex((p) => p.id === selectedPage.id);
							if (activeIndex === -1) return;

							// jika sudah ter-sync ke database hapus di server
							const isSynced = pages[activeIndex].syncedId !== null;

							// tandai sebagai aksi hapus
							isDeletedRef.current = true;

							// Don't let a pending autosave resurrect the
							// page we're about to delete.
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
									updateIsDirty(false);

									await excalidrawAPI?.resetScene();
									excalidrawAPI?.updateScene({
										appState: {
											...excalidrawAPI?.getAppState(),
											...excalidrawAppProps.appState,
										},
									});
									setHasContent(false);
									return;
								}

								// pilih page berikutnya kalau ada, atau page sebelumnya kalau yang dihapus adalah terakhir
								const nextActiveIndex = Math.min(activeIndex, remaining.length - 1);
								const reAssign = remaining.map((p, idx) => ({
									...p,
									pageNum: idx + 1,
									isActive: idx === nextActiveIndex,
								}));

								await NotesRepository.updatePagesBulk(
									remaining.map((p, idx) => ({
										id: p.id,
										workspaceId: p.workspaceId,
										workspaceNoteId: p.workspaceNoteId,
										learningSessionId: p.learningSessionId,
										syncedId: p.syncedId,
										pageNum: idx + 1,
										isActive: idx === nextActiveIndex,
									}),
										isSynced ? true : false // delete in the server to?
									));

								setPages([...reAssign]);
								updateIsDirty(false);

								// Set directly from the data we already have
								// — routing this through selectPageHandler
								// here would read a stale `pages` closure
								// (state hasn't re-rendered with `reindexed`
								// yet) and write incomplete data back to the DB.
								setSelectedPage(reAssign[nextActiveIndex]);

								// unlock delete ref
								setTimeout(() => {
									isDeletedRef.current = false;
								}, 250);
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

export default CanvasEditorPage;