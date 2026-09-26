import {
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

interface RouteParams {
    conversationId?: string;
    [key: string]: string | undefined;
}

type Inputs = {
    message: string;
};

// ============================================================
// Lapis 1: shell + sidebar. Nggak pernah remount tiap ganti
// percakapan, jadi IonMenu/IonSplitPane selalu stabil.
// ============================================================
const ChatbotPage: React.FC = () => {
    const { name = 'Ritize! Chat', conversationId } = useParams<RouteParams>();
    const [session, setSession] = useState<any>(null);

    const { data: chats, isLoading } = useGetConversationsQuery();

    useEffect(() => {
        const fetchSession = async () => {
            const session = await getSession();
            setSession(session);
        };
        fetchSession();
    }, []);

    useEffect(() => {
        (async () => {
            await supabase.auth.refreshSession();
        })();
    }, []);

    return (
        <IonSplitPane when={false} contentId="main-chat">
            <IonMenu contentId="main-chat" menuId="chat-history-menu">
                <IonHeader className="ion-no-border">
                    <IonToolbar color="light" className="px-5 borderless">
                        <IonTitle className="text-base text-sm text-neutral-600">Chat History</IonTitle>
                    </IonToolbar>
                </IonHeader>
                <IonContent className="ion-padding !pt-0 chat-history" color={'light'}>
                    {isLoading && <IonSpinner color={'dark'} />}
                    {!isLoading && chats && chats.length > 0 && (
                        <IonList lines="none" className="!py-0 !mt-0 !bg-transparent">
                            {chats.map((c: ChatTypes) => (
                                <IonMenuToggle key={c.id} autoHide={false} menu="chat-history-menu">
                                    <IonItem
                                        button={true}
                                        detail={true}
                                        className="clear"
                                        style={{ '--padding-top': '4px', '--padding-bottom': '4px' }}
                                        routerLink={`/dashboard/chatbot/c/${c.conversation_id}`}
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
            <ChatBody
                key={conversationId ?? 'new'}
                conversationId={conversationId}
                session={session}
                name={name}
            />
        </IonSplitPane>
    );
};

// ============================================================
// Lapis 2: cuma urus fetch history + gating. TIDAK memanggil
// useChat sama sekali, supaya useChat di lapis 3 nggak pernah
// ke-mount duluan dengan messages kosong.
// ============================================================
const ChatBody: React.FC<{ conversationId?: string; session: any; name: string }> = ({
    conversationId,
    session,
    name,
}) => {
    const router = useIonRouter();
    const [getConversation] = useLazyGetConversationByIdQuery();
    const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);
    const [historyReady, setHistoryReady] = useState(!conversationId);

    useEffect(() => {
        if (!conversationId) {
            setHistoryReady(true);
            return;
        }
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
    }, [conversationId, getConversation]);

    const ready = !!session && historyReady;

    const newChatHandler = async () => {
        const newId = generateId();
        router.push(`/dashboard/chatbot/c/${newId}`, 'root', 'push');
    };

    return (
        <IonPage id="main-chat">
            <IonHeader className="ion-no-border">
                <IonToolbar color={'light'} className="borderless">
                    <IonButtons slot="start" className="ion-padding-start">
                        <IonBackButton defaultHref="/dashboard" />
                    </IonButtons>
                    <IonTitle className="text-base text-center fixed left-16 right-12 top-0 bottom-0 text-lg">
                        {name}
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

            {ready ? (
                <ChatUI conversationId={conversationId} session={session} initialMessages={initialMessages} />
            ) : (
                <IonContent className="ion-padding flex items-center justify-center" color={'light'}>
                    <div className='h-full w-full flex items-center justify-center'>
                        <IonSpinner color="dark" />
                    </div>
                </IonContent>
            )}
        </IonPage>
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
}> = ({ conversationId, session, initialMessages }) => {
    const contentRef = useRef<HTMLIonContentElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const { messages, error, sendMessage, status, stop } = useChat({
        id: conversationId,
        messages: initialMessages,
        transport: new DefaultChatTransport({
            api: `${import.meta.env.VITE_CHAT_BASE_URL}`,
            headers: { Authorization: `Bearer ${session?.access_token}` },
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
    const isWaiting = status === 'submitted' || status === 'streaming';
    const lastMessage = messages[messages.length - 1];
    const lastMessageHasText = getTextParts(lastMessage?.parts).length > 0;
    const showTypingIndicator = isWaiting && (lastMessage?.role !== 'assistant' || !lastMessageHasText);

    const { control, handleSubmit, reset, watch } = useForm<Inputs>({ defaultValues: { message: '' } });
    const messageValue = watch('message');
    const isMessageEmpty = !messageValue?.trim();

    const dispatch = useDispatch<AppDispatch>();

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

    return (
        <>
            <IonContent ref={contentRef} color={'light'} className="ion-padding">
                <div className="w-full sm:w-12/12 md:w-8/12 lg:w-7/12 xl:w-5/12 mx-auto">
                    <div className="flex flex-col gap-4">
                        {visibleMessages.map((m, index) => (
                            <div key={`${m.id}-${index}`} className="block">
                                {m.role === 'user' && (
                                    <div className="flex w-full justify-end user-box">
                                        <div className="bg-neutral-200 rounded-4xl max-w-[80%] p-3 shadow-md">
                                            {getTextParts(m.parts).map((part, i) => (
                                                <div key={i} className="text-base">
                                                    <RichContent content={part.text} />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {m.role === 'assistant' && (
                                    <div className="block message-box">
                                        {getTextParts(m.parts).map((part, i) => (
                                            <div key={i} className="text-base">
                                                <RichContent content={part.text} />
                                            </div>
                                        ))}

                                        <div className='text-xs text-gray-500 italic'>
                                            spend {(m.metadata as any)?.usage?.totalTokens ?? "…"} tokens
                                        </div>
                                    </div>
                                )}
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

            <IonFooter color="light" className="ion-no-border ion-no-background chat-footer">
                <div className="ion-padding">
                    <div className="w-full sm:w-12/12 md:w-8/12 lg:w-7/12 xl:w-5/12 mx-auto">
                        <div className="bg-white rounded-3xl shadow-lg">
                            <form onSubmit={handleSubmit(onSubmit)}>
                                <Controller
                                    name="message"
                                    control={control}
                                    render={({ field }) => (
                                        <IonTextarea
                                            className="clear-input px-3"
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
                                    {status !== 'streaming' && status !== 'submitted' && (
                                        <IonButton type="submit" mode="ios" shape="round" disabled={isWaiting || isMessageEmpty} color="dark">
                                            <IonIcon icon={arrowUp} slot="icon-only" />
                                        </IonButton>
                                    )}
                                    {(status === 'submitted' || status === 'streaming') && (
                                        <IonButton color="danger" mode="ios" shape="round" type="button" onClick={() => stop()}>
                                            <IonIcon icon={stopSharp} slot="icon-only" />
                                        </IonButton>
                                    )}
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </IonFooter>
        </>
    );
};

export default ChatbotPage;