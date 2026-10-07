import {
    IonAccordion,
    IonAccordionGroup,
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonFooter,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonMenu,
    IonMenuToggle,
    IonPage,
    IonSpinner,
    IonSplitPane,
    IonText,
    IonTextarea,
    IonTitle,
    IonToolbar,
    useIonRouter,
} from '@ionic/react';
import { useParams } from 'react-router';
import './Page.css';
import { useEffect, useRef, useState } from 'react';
import { DefaultChatTransport, generateId } from 'ai';
import { useChat } from '@ai-sdk/react';
import type { UIMessage } from '@ai-sdk/react';
import { getSession, getUser } from '../../../utils/authState';
import { useForm, SubmitHandler, Controller } from 'react-hook-form';
import { arrowUp, createOutline, listOutline, stopSharp } from 'ionicons/icons';
import { supabase } from '../../../lib/supabase';
import { RichContent } from '../../../utils/richRenderer';
import { addFakeConversation, ChatTypes, useGetConversationsQuery, useLazyGetConversationByIdQuery } from '../../../services/chat';
import { format } from 'date-fns';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../../../store';
import { updateUserState } from '../../../services/user';
import { Preferences } from '@capacitor/preferences';

interface RouteParams {
    conversationId?: string;
    [key: string]: string | undefined;
}

type Inputs = {
    message: string;
};

const DEMO_USER_ID = 'a1ffa462-1595-4373-92ff-2d422cbef153';
const DEMO_USER_EMAIL = 'hellopuyup@gmail.com';
const DEMO_USER_PASSWORD = 'demochat123!';
const DEMO_GREETING =
    'This demo user have notes from August 1, 2026 to September 25, 2026 ' +
    'covering electronics, physics, shipbuilding, and economics.';

const DEMO_PROMPT = 'Which date are my notes about ships from?';

type NoteResult = {
    content: string;
    content_source: string;
    content_type: string;
    created_at: string;
    study_class_name: string;
    workspace_id: string;
    note_id: string;
    session_id: string;
    distance: number;
};

function parseToolResult(output: any): any[] {
    const raw =
        output?.structuredContent?.result ??
        output?.content?.find((c: any) => c.type === "text")?.text;
    if (!raw) return [];
    try {
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function getNoteResults(parts: UIMessage["parts"]): NoteResult[] {
    const map = new Map<string, NoteResult>(); // dedupe antar pemanggilan tool
    for (const part of parts as any[]) {
        if (
            part.type !== "dynamic-tool" ||
            part.toolName !== "search_notes" ||
            part.state !== "output-available" ||
            part.output?.isError
        ) continue;

        for (const note of parseToolResult(part.output)) {
            // fallback ke note_id supaya tidak semua note jatuh ke key `undefined`
            map.set(note.note_page__id ?? note.note_id, note);
        }
    }
    return [...map.values()];
}

function NoteCard({ note }: { note: NoteResult }) {
    let editor = 'richtext';
    if (note.content_type == 'canvas') {
        editor = 'canvas';
    } else if (note.content_type == 'file') {
        editor = 'files';
    }
    return (
        <IonItem
            className="clearx !bg-transparent !pl-0 rounded-xl shadow"
            lines="none"
            routerLink={`/dashboard/editor/${editor}?workspaceId=${note.workspace_id}&noteId=${note.note_id}&sessionId=${note.session_id}`}
            detail={true}
            button={true}
            style={{
                '--background': '#ede5c3',
                '--border-width': '1px',
                '--border-radius': '0.75rem',
                '--min-height': '36px',
                '--padding-start': '8px',
                '--inner-padding-end': '8px',
                '--padding-top': '4px',
                '--padding-bottom': '4px',
            }}
        >
            <IonLabel className='line-clamp-1 !overflow-hidden ion-padding-end'>
                <p className="line-clamp-1 !overflow-hidden !text-xs !text-neutral-700 !mb-0">{note.study_class_name}</p>
                <p className='line-clamp-1 !overflow-hidden !text-xs !text-neutral-500 !mb-0'>{note.content_source}</p>
            </IonLabel>

            <IonText className="!text-xs text-neutral-700" slot='end'>{format(note.created_at, 'MMM dd yy')}</IonText>
        </IonItem>
    );
}

// ============================================================
// Lapis 1: shell + sidebar. Nggak pernah remount tiap ganti
// percakapan, jadi IonMenu/IonSplitPane selalu stabil.
// ============================================================
const ChatbotPage: React.FC = () => {
    const router = useIonRouter();
    const { name = 'Ritize! Chat', userId, conversationId } = useParams<RouteParams>();

    // Satu-satunya sumber kebenaran: diturunkan langsung dari route, bukan state.
    const isDemo = userId === DEMO_USER_ID;

    const [session, setSession] = useState<any>(null);

    // Query riwayat menunggu sesi siap (di mode demo, sesi dibuat dulu).
    const { data: chats, isLoading } = useGetConversationsQuery(
        { from: 0, to: 50 },
        { skip: !session }
    );

    // Helper agar semua link konsisten antara mode demo dan mode biasa.
    const chatPath = (id: string) =>
        isDemo ? `/chatbot/u/${DEMO_USER_ID}/c/${id}` : `/dashboard/chatbot/c/${id}`;

    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                if (isDemo) {
                    // Jangan login ulang kalau sudah memakai sesi demo.
                    const current = await getSession();
                    if (current?.user?.email === DEMO_USER_EMAIL) {
                        if (!cancelled) setSession(current);
                        return;
                    }

                    const { data, error } = await supabase.auth.signInWithPassword({
                        email: DEMO_USER_EMAIL,
                        password: DEMO_USER_PASSWORD,
                    });
                    if (error || !data.session || !data.user) {
                        throw error ?? new Error('Demo login failed');
                    }

                    // Ambil data user dari tabel custom `user`
                    const { data: customUser, error: customUserError } = await supabase
                        .from('user')
                        .select('*')
                        .eq('auth_user_id', data.user.id)
                        .single();
                    if (customUserError) throw customUserError;

                    await Preferences.set({
                        key: 'ritize_user',
                        value: JSON.stringify({ ...customUser, session: data.session }),
                    });

                    if (!cancelled) setSession(data.session);
                } else {
                    await supabase.auth.refreshSession();
                    const s = await getSession();
                    if (!cancelled) setSession(s);
                }
            } catch (e) {
                console.error('fetchSession error', e);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [isDemo]);

    const newChatHandler = () => {
        router.push(chatPath(generateId()), 'root', 'push');
    };

    return (
        <IonSplitPane when={false} contentId="main-chat">
            <IonMenu contentId="main-chat" menuId="chat-history-menu">
                <IonHeader className="ion-no-border">
                    <IonToolbar color="light" className="px-5 borderless">
                        <IonTitle className="text-base text-sm text-neutral-600">Chat History</IonTitle>
                    </IonToolbar>
                </IonHeader>
                <IonContent className="ion-padding !pt-0 chat-history" color={'light'}>
                    {(isLoading || !session) && <IonSpinner color={'dark'} />}
                    {!isLoading && chats && chats.length > 0 && (
                        <IonList lines="none" className="!py-0 !mt-0 !bg-transparent">
                            {chats.map((c: ChatTypes) => (
                                <IonMenuToggle key={c.id} autoHide={false} menu="chat-history-menu">
                                    <IonItem
                                        button={true}
                                        detail={true}
                                        className="clear"
                                        style={{ '--padding-top': '4px', '--padding-bottom': '4px' }}
                                        routerLink={chatPath(c.conversation_id)}
                                        routerDirection={'root'}
                                    >
                                        <IonLabel>
                                            <IonText className="!text-sm albert-font line-clamp-1">
                                                {c.title ? c.title : c.conversation_id}
                                            </IonText>
                                            <p className="!text-xs !font-normal !text-neutral-500">
                                                {format(new Date(c.created_at), 'MMM dd, yyyy h:mm a')}
                                            </p>
                                        </IonLabel>
                                    </IonItem>
                                </IonMenuToggle>
                            ))}
                        </IonList>
                    )}
                </IonContent>
            </IonMenu>

            {/*
              key={conversationId} memaksa React remount total ChatBody tiap
              ganti percakapan -> useChat selalu instance baru dari nol.
            */}
            <IonPage id="main-chat">
                <IonHeader className="ion-no-border">
                    <IonToolbar color={'light'} className="borderless">
                        <IonButtons slot="start" className="ion-padding-start">
                            <IonBackButton defaultHref={isDemo ? '/' : `/dashboard`} />
                        </IonButtons>

                        <IonTitle className="text-base text-center fixed left-16 right-12 top-0 bottom-0 text-lg">
                            {isDemo ? 'Ritize! Chat' : name}
                        </IonTitle>

                        <div className='ion-padding-end flex items-center gap-x-3' slot='end'>
                            <IonButton
                                fill={'clear'}
                                shape="round"
                                mode="md"
                                color="dark"
                                className="normal-button"
                                onClick={newChatHandler}
                            >
                                <IonIcon icon={createOutline} slot="icon-only" />
                            </IonButton>

                            <IonMenuToggle menu="chat-history-menu">
                                <IonButton fill={'solid'} shape="round" mode="md" color="white" className="normal-button">
                                    <IonIcon icon={listOutline} slot="icon-only" />
                                </IonButton>
                            </IonMenuToggle>
                        </div>
                    </IonToolbar>
                </IonHeader>

                <ChatBody
                    key={conversationId ?? 'new'}
                    conversationId={conversationId}
                    session={session}
                    isDemo={isDemo}
                />
            </IonPage>
        </IonSplitPane>
    );
};

// ============================================================
// Lapis 2: cuma urus fetch history + gating. TIDAK memanggil
// useChat sama sekali, supaya useChat di lapis 3 nggak pernah
// ke-mount duluan dengan messages kosong.
// ============================================================
const ChatBody: React.FC<{ conversationId?: string; session: any; isDemo: boolean }> = ({
    conversationId,
    session,
    isDemo,
}) => {
    const [getConversation] = useLazyGetConversationByIdQuery();
    const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);
    const [historyReady, setHistoryReady] = useState(!conversationId);

    useEffect(() => {
        if (!conversationId) {
            setHistoryReady(true);
            return;
        }
        // Tunggu sesi siap (penting di mode demo) sebelum fetch riwayat.
        if (!session) return;

        let cancelled = false;
        (async () => {
            const { data } = await getConversation(conversationId);
            if (!cancelled) {
                setInitialMessages(data?.messages ?? []);
                setHistoryReady(true);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [conversationId, getConversation, session]);

    const ready = !!session && historyReady;

    return (
        <>
            {ready ? (
                <ChatUI
                    conversationId={conversationId}
                    session={session}
                    initialMessages={initialMessages}
                    isDemo={isDemo}
                />
            ) : (
                <IonContent className="ion-padding flex items-center justify-center" color={'light'}>
                    <div className='h-full w-full flex items-center justify-center'>
                        <IonSpinner color="dark" />
                    </div>
                </IonContent>
            )}
        </>
    );
};

// ============================================================
// Lapis 3: baru di sini useChat dipanggil -- pertama kali,
// langsung dengan initialMessages yang sudah lengkap.
// ============================================================
const ChatUI: React.FC<{
    conversationId?: string;
    session: any;
    initialMessages: UIMessage[];
    isDemo: boolean;
}> = ({ conversationId, session, initialMessages, isDemo }) => {
    const ionRouter = useIonRouter();
    const dispatch = useDispatch<AppDispatch>();
    const contentRef = useRef<HTMLIonContentElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const { messages, error, sendMessage, status, stop } = useChat({
        id: conversationId,
        messages: initialMessages,
        transport: new DefaultChatTransport({
            api: `${import.meta.env.VITE_CHAT_BASE_URL}`,
            headers: { Authorization: `Bearer ${session?.access_token}` },
            // cegah mengirim ulang semua message ke server
            // hanya gunakan message terakhir (incremental message)
            prepareSendMessagesRequest: ({ id, messages }) => ({
                body: {
                    id,
                    message: messages[messages.length - 1],
                },
            }),
        }),
        onFinish: async ({ message }) => {
            const user = await getUser();
            const meta = message?.metadata as { remainingBalance: number };
            if (meta?.remainingBalance !== undefined) {
                dispatch(updateUserState({
                    id: user.id,
                    token_balance: meta?.remainingBalance,
                }));
            }
        },
        onError: (error: Error) => console.error(error, 'ERROR'),
    });

    type ChatMessage = (typeof messages)[number];
    type MessagePart = ChatMessage['parts'][number];
    type TextPart = Extract<MessagePart, { type: 'text' }>;
    const isTextPart = (part: MessagePart): part is TextPart => part.type === 'text';
    const getTextParts = (parts: MessagePart[] | undefined): TextPart[] =>
        (parts ?? []).filter(isTextPart).filter((p) => p.text.trim().length > 0);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
    }, [messages, status]);

    const visibleMessages = messages.filter((m) => getTextParts(m.parts).length > 0);
    const hasVisibleMessages = visibleMessages.length > 0;
    const isWaiting = status === 'submitted' || status === 'streaming';
    const lastMessage = messages[messages.length - 1];
    const lastMessageHasText = getTextParts(lastMessage?.parts).length > 0;
    const showTypingIndicator = isWaiting && (lastMessage?.role !== 'assistant' || !lastMessageHasText);

    const { control, handleSubmit, reset, watch, setValue } = useForm<Inputs>({ defaultValues: { message: '' } });
    const messageValue = watch('message');
    const isMessageEmpty = !messageValue?.trim();

    const onSubmit: SubmitHandler<Inputs> = async (data) => {
        if (!data.message.trim() || !conversationId) return;

        if (messages.length <= 0) {
            dispatch(
                addFakeConversation(
                    conversationId,
                    new Date().toISOString(),
                    data.message.trim()
                )
            );
        }

        sendMessage({ text: data.message.trim() });
        contentRef.current?.scrollToBottom();
        reset();
    };

    // demo: keluar dari sesi demo dan mulai dengan catatan sendiri
    const startWithOwnNotes = async () => {
        await supabase.auth.signOut();
        // hapus hanya key milik mode demo, bukan seluruh preferences
        await Preferences.remove({ key: 'ritize_user' });
        // redirect ke halaman intro
        ionRouter.push('/?index=2', 'root', 'replace');
    };

    return (
        <>
            <IonContent ref={contentRef} color={'light'} className="ion-padding">
                <div className="w-full sm:w-12/12 md:w-8/12 lg:w-7/12 xl:w-5/12 mx-auto">
                    <div className="flex flex-col gap-4">
                        {isDemo && !hasVisibleMessages && (
                            <div className="mt-10 text-center text-neutral-600">
                                <p className="text-base font-medium">Hello! 👋</p>
                                <p className="text-sm mt-1">{DEMO_GREETING}</p>
                                <IonButton
                                    fill="outline"
                                    shape="round"
                                    mode="ios"
                                    color="dark"
                                    className="mt-3"
                                    onClick={() => setValue('message', DEMO_PROMPT)}
                                >
                                    <IonText className="text-sm">Try: "{DEMO_PROMPT}" (click here)</IonText>
                                </IonButton>
                            </div>
                        )}

                        {visibleMessages.map((m, index) => (
                            <div key={`${m.id}-${index}`} className="block">
                                {m.role === 'user' && (
                                    <div className="flex w-full justify-end user-box">
                                        <div className="bg-neutral-200 rounded-4xl max-w-[80%] p-2 px-4 shadow-md">
                                            {getTextParts(m.parts).map((part, i) => (
                                                <div key={i} className="text-base">
                                                    <RichContent content={part.text} />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {m.role === 'assistant' && (() => {
                                    const notes = getNoteResults(m.parts);
                                    return (
                                        <div className="block message-box">
                                            {getTextParts(m.parts).map((part, i) => (
                                                <div key={i} className="text-base">
                                                    <RichContent content={part.text} />
                                                </div>
                                            ))}

                                            {notes.length > 0 && (
                                                <div className="mt-3 flex flex-col gap-2 mb-2">
                                                    <IonAccordionGroup className='ion-no-background'>
                                                        <IonAccordion value={`${m.id}-${index}`} className='ion-no-background'>
                                                            <IonItem slot="header" color="light" className='ion-no-padding'>
                                                                <IonLabel>{notes.length} related notes</IonLabel>
                                                            </IonItem>
                                                            <div className="flex flex-col gap-3" slot="content">
                                                                {notes.map((n, index) => (
                                                                    <NoteCard key={index} note={n} />
                                                                ))}
                                                            </div>
                                                        </IonAccordion>
                                                    </IonAccordionGroup>
                                                </div>
                                            )}

                                            <div className='text-xs text-gray-500 italic'>
                                                spend {(m.metadata as any)?.usage?.totalTokens ?? "…"} tokens
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        ))}
                        {showTypingIndicator && (
                            <div className="typing-indicator"><span></span><span></span><span></span></div>
                        )}
                    </div>
                    {error && (
                        <div className='block'>
                            <div className="mt-4 bg-red-100 rounded-xl shadow-md px-2 py-1 inline-block">
                                <IonText color="danger" className='text-sm'>{error.message}</IonText>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </IonContent>

            <IonFooter color="light" className="ion-no-border chat-footer">
                <div className="ion-padding">
                    <div className="w-full sm:w-12/12 md:w-8/12 lg:w-7/12 xl:w-5/12 mx-auto">
                        <div className="bg-white rounded-3xl shadow-md">
                            <form onSubmit={handleSubmit(onSubmit)}>
                                <Controller
                                    name="message"
                                    control={control}
                                    render={({ field }) => (
                                        <IonTextarea
                                            className="clear-input px-3 leading-5"
                                            autoGrow={true}
                                            value={field.value}
                                            onIonInput={(e) => field.onChange(e.detail.value ?? '')}
                                            onIonBlur={field.onBlur}
                                            rows={1}
                                            placeholder="Ask anything about your notes..."
                                        />
                                    )}
                                />
                                <div className="px-2 pb-2 flex justify-end">
                                    {!isWaiting && (
                                        <IonButton type="submit" mode="ios" shape="round" disabled={isMessageEmpty} color="dark">
                                            <IonIcon icon={arrowUp} slot="icon-only" />
                                        </IonButton>
                                    )}
                                    {isWaiting && (
                                        <IonButton color="danger" mode="ios" shape="round" type="button" onClick={() => stop()}>
                                            <IonIcon icon={stopSharp} slot="icon-only" />
                                        </IonButton>
                                    )}
                                </div>
                            </form>
                        </div>

                        {isDemo && (
                            <div className="mt-4 text-center">
                                <IonButton
                                    fill="solid"
                                    shape="round"
                                    mode='ios'
                                    color="dark"
                                    onClick={startWithOwnNotes}
                                    routerDirection='root'
                                >
                                    Start with My Notes
                                </IonButton>
                            </div>
                        )}
                    </div>
                </div>
            </IonFooter>
        </>
    );
};

export default ChatbotPage;