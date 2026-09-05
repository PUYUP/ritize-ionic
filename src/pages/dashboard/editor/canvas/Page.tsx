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
import { useCallback, useEffect, useRef, useState } from 'react';
import { copyOutline, duplicateOutline, trashOutline } from 'ionicons/icons';
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
import { NoteFormatTypes, NotePageTypes, NoteTypes, useGetNoteByIdQuery, useLazyGetNoteByIdQuery, useUpsertNoteMutation } from '../../../../services/notes';
import { useGetWorkspaceByIdQuery } from '../../../../services/workspace';
import { getFileTypePure, uploadFileToGCS } from '../../../../utils/gcs-upload-client';
import { UploadProgress } from '../../../../types/upload';
import { getUser } from '../../../../utils/authState';
import { supabase } from '../../../../utils/supabaseClient';
import { generateUUID } from '../../../../utils/generator';

const AUTOSAVE_DELAY_MS = 1500;

// Posisi & zoom yang dikunci — canvas selalu balik ke sini
const LOCKED_VIEW = { scrollX: 0, scrollY: 0, zoomValue: 1 };

/**
 * A scene is "empty" only if it has no visible (non-deleted) elements.
 * Mirrors isDeltaEmpty() in the text editor: we only want to write
 * contentData: null when there's truly nothing worth keeping.
 */
function isElementsEmpty(elements: readonly ExcalidrawElement[] | null | undefined): boolean {
	if (!elements || elements.length === 0) return true;
	return !elements.some((el) => !el.isDeleted);
}

const CanvasEditorPage: React.FC = () => {
	const [searchParams, setSearchParams] = useSearchParams();
	const workspaceId = searchParams.get('workspaceId');
	const noteId = searchParams.get('noteId');

	const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null);
	const [isLoaded, setIsLoaded] = useState(false);
	const [isDirty, setIsDirty] = useState(false);
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

	const width = useDeviceWidth();

	const pagesSwiperElRef = useRef<HTMLDivElement>(null);
	const pagesSwiperRef = useRef<Swiper | null>(null);
	const prevPagesLengthRef = useRef(pages.length);
	const prevNoteIdRef = useRef<string | null>(searchParams.get('noteId'));

	// RTK Query
	const [getNoteById, { data: noteData, isLoading: gettingNote, isError: gettingNoteError }] = useLazyGetNoteByIdQuery();
	const [upsertNote] = useUpsertNoteMutation();
	const { data: workspaceData } = useGetWorkspaceByIdQuery(workspaceId ?? "", { skip: !workspaceId });

	// excalidraw setups
	const excalidrawAppProps = {
		appState: {
			currentItemStrokeWidth: 0.5,
			currentItemStrokeColor: '#1e1e1e',
			gridStep: width,
			activeTool: {
				type: 'freedraw' as const,
				customType: null,
				locked: false,
				lastActiveTool: null,
				fromSelection: false,
			},
			penMode: false,
		} as any
	}

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
		setIsSaving(true);
		try {
			const contentEmpty = isElementsEmpty(elements);
			const json = contentEmpty ? null : serializeAsJSON(elements, appState, files, 'local');

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

			// extract as image
			const blob = await exportToBlob({
				elements: elements,
				appState: { exportBackground: true },
				mimeType: "image/png",
			});

			const file = new File([blob], 'canvas.png', { type: 'image/png' });
			let progress = 0;


			const user = await getUser();
			const result = await uploadFileToGCS(
				file,
				{ onProgress: (p: UploadProgress) => { progress = p.percentage; } },
				{
					pageId: page.id,
					workspaceId: workspaceId,
				}
			);

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
				entity_id: page.id,
				purpose: 'canvas_image',
			}

			// delete attachment sebelumnya
			await supabase.from("attachments")
				.delete()
				.eq('user_id', user.id)
				.eq('entity_type', 'workspace_notes_pages')
				.eq('entity_id', page.id)
				.eq('purpose', 'canvas_image')

			const { data: attachmentData, error: attachmentError } = await supabase.from("attachments")
				.insert(attachmentPayload)
				.select('*')
				.single();

			console.log(attachmentData);
		} catch (err) {
			console.error('Failed to save canvas', err);
			presentToast({ message: 'Could not save your changes.', duration: 2500, color: 'danger' });
		} finally {
			setIsSaving(false);
		}
	}, [presentToast]);

	// Persists whatever is currently on the canvas for the currently
	// selected page.
	const persistCurrentPage = useCallback(async () => {
		if (!excalidrawAPI || !selectedPage) return;
		await persistPageContent(
			selectedPage,
			excalidrawAPI.getSceneElements(),
			excalidrawAPI.getAppState(),
			excalidrawAPI.getFiles(),
		);
		setIsDirty(false);
	}, [excalidrawAPI, selectedPage, persistPageContent]);

	// Cancels any pending debounced autosave and, if there are unsaved
	// changes, saves them immediately for the CURRENT page.
	//
	// This must be awaited before switching pages, adding a page, or
	// leaving the editor. Without it, a pending autosave (scheduled while
	// page A was active) can fire after page B's content has already been
	// swapped into the canvas, saving page B's content under page A's id.
	const flushPendingSave = useCallback(async () => {
		if (autosaveTimer.current) {
			clearTimeout(autosaveTimer.current);
			autosaveTimer.current = undefined;
		}
		if (!isDirty) return;
		await persistCurrentPage();
	}, [isDirty, persistCurrentPage]);

	const handleSceneChange = useCallback((elements: readonly ExcalidrawElement[], appState: AppState) => {
		const visibleElements = elements.filter((el) => !el.isDeleted);
		setHasContent(visibleElements.length > 0);

		setIsDirty(true);

		if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
		autosaveTimer.current = setTimeout(() => {
			void persistCurrentPage();
		}, AUTOSAVE_DELAY_MS);
	}, [persistCurrentPage]);

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
			direction: 'vertical',
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
		if (!excalidrawAPI || !selectedPage) return;

		const loadContentData = async () => {
			const contentData = selectedPage?.contentData;

			if (contentData) {
				try {
					const decoder = new TextDecoder('utf-8');
					const jsonString = decoder.decode(contentData);

					if (!jsonString) return;

					const json = JSON.parse(jsonString);

					setHasContent(!isElementsEmpty(json.elements));
					// Seed the dedupe ref so the onChange this triggers
					// doesn't cause an immediate, redundant re-save.
					lastSavedDataRef.current = jsonString;

					setTimeout(() => {
						excalidrawAPI.updateScene({
							elements: json.elements,
							appState: {
								...json.appState,
								...excalidrawAppProps.appState,
							},
						});
					}, 100);
				} catch (error) {
					console.error('Failed to parse saved content', error);
				}
			} else {
				setHasContent(false);
				lastSavedDataRef.current = null;

				setTimeout(() => {
					excalidrawAPI.updateScene({
						elements: [],
						appState: excalidrawAppProps.appState,
					});
				}, 100);
			}
		};

		loadContentData();
	}, [selectedPage, excalidrawAPI]);

	// select page
	const selectPageHandler = async (page: Page) => {
		if (selectedPage?.id === page.id) return;

		try {
			// Flush any unsaved edits on the OUTGOING page before touching
			// selectedPage / swapping the canvas' content.
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
			title: "Untitled Canvas",
			content: "",
			noteDatetime: new Date(),
			// NOTE: verify "canvas" is a valid member of your NoteFormatTypes
			// union — swap for whatever value your backend/schema expects.
			contentType: "canvas",
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
		else if (gettingNoteError) {
			// noteId was provided, nothing local, and the server
			// fetch failed — surface this instead of a silently
			// blank editor.
			presentToast({ message: 'Could not load this note.', duration: 2500, color: 'danger' });
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

	// Reset state & canvas saat berpindah antar note (mengatasi isu cache/stale data)
	useEffect(() => {
		if (prevNoteIdRef.current !== noteId) {
			setPages([]);
			setSelectedPage(null);
			setSelectedNote(null);
			lastSavedDataRef.current = null;
			prevNoteIdRef.current = noteId;

			if (excalidrawAPI) {
				excalidrawAPI.updateScene({ elements: [], appState: excalidrawAppProps.appState });
			}
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [noteId]);

	return (
		<IonPage>
			<IonHeader className='ion-no-border'>
				<IonToolbar className='fixed'>
					<IonButtons slot="start" className='ion-padding-start'>
						<IonBackButton defaultHref='/' />
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
						onExcalidrawAPI={(api: ExcalidrawImperativeAPI | null) => {
							setExcalidrawAPI(api);
							if (api) setIsLoaded(true);
						}}
						onChange={(elements, appState) => {
							if (!excalidrawAPI) return;
							handleSceneChange(elements, appState);
						}}
						// onScrollChange={handleScrollChange}
						gridModeEnabled={true}
						zenModeEnabled={true}
						viewModeEnabled={false}
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

					<div
						className='fixed w-[42px] right-2 bottom-[120px] z-10'
						style={{ 'top': 'calc(60px + var(--ion-safe-area-top, 0))', 'paddingBottom': 'var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0))' }}
					>
						<div className='flex flex-col gap-3 items-center justify-between h-full'>
							<div className='flex-1 pt-2 overflow-hidden'>
								<div ref={pagesSwiperElRef} className='swiper h-full w-full'>
									<div id="pages-list" className='swiper-wrapper flex flex-col'>
										{pages.map((page) => (
											<div key={page.id} className='swiper-slide !h-auto !w-auto flex-none'>
												<IonButton
													size='small'
													shape="round"
													color={page.isActive ? 'light' : 'light'}
													onClick={async () => await selectPageHandler(page)}
													className={`mb-2 font-normal ${page.isActive ? 'font-semibold page-active' : ''}`}
												>
													<IonText slot='icon-only'>{page.pageNum}</IonText>
												</IonButton>
											</div>
										))}
									</div>
								</div>
							</div>

							<div>
								<IonButton size='small' shape="round" color={'light'} onClick={async () => await newPageHandler()}>
									<IonIcon icon={duplicateOutline} slot='icon-only'></IonIcon>
								</IonButton>
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

							// Don't let a pending autosave resurrect the
							// page we're about to delete.
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

								const reindexed = remaining.map((p, idx) => ({
									...p,
									pageNum: idx + 1,
									isActive: idx === nextActiveIndex,
								}));

								await NotesRepository.updatePagesBulk(reindexed);
								setPages(reindexed);
								setIsDirty(false);

								// Set directly from the data we already have
								// — routing this through selectPageHandler
								// here would read a stale `pages` closure
								// (state hasn't re-rendered with `reindexed`
								// yet) and write incomplete data back to the DB.
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

export default CanvasEditorPage;