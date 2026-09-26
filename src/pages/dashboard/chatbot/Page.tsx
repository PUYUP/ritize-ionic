import { IonBackButton, IonButton, IonButtons, IonCard, IonCardContent, IonContent, IonFooter, IonHeader, IonIcon, IonPage, IonText, IonTextarea, IonTitle, IonToolbar } from '@ionic/react';
import { useParams } from 'react-router';
import './Page.css';
import { useEffect, useRef, useState } from 'react';
import { DefaultChatTransport } from 'ai';
import { useChat } from '@ai-sdk/react';
import { getSession } from '../../../utils/authState';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useForm, SubmitHandler, Controller } from 'react-hook-form';
import { arrowUp, stopSharp } from 'ionicons/icons';
import { supabase } from '../../../lib/supabase';

type Inputs = {
    message: string
}

const ChatbotPage: React.FC = () => {
    const [session, setSession] = useState<any>(null);
    const { name = 'Notes Chatbot' } = useParams<{ name: string; }>();

    const contentRef = useRef<HTMLIonContentElement>(null);

    useEffect(() => {
        const fetchSession = async () => {
            const session = await getSession();
            console.log(session);
            setSession(session);
        };
        fetchSession();
    }, []);

    const { messages, error, sendMessage, status, stop } = useChat({
        transport: new DefaultChatTransport({
            api: `${import.meta.env.VITE_CHAT_BASE_URL}`,
            headers: {
                'Authorization': `Bearer ${session?.access_token}`,
            },
        }),
        onError: (error: Error) => console.error(error, 'ERROR'),
    });

    // Tipe part & text diambil langsung dari `messages`, jadi selalu cocok
    // dengan versi UIMessage yang dipakai hook ini (termasuk custom part types).
    type ChatMessage = (typeof messages)[number];
    type MessagePart = ChatMessage['parts'][number];
    type TextPart = Extract<MessagePart, { type: 'text' }>;

    const isTextPart = (part: MessagePart): part is TextPart => part.type === 'text';

    const getTextParts = (parts: MessagePart[] | undefined): TextPart[] =>
        (parts ?? []).filter(isTextPart).filter(p => p.text.trim().length > 0);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, status]);

    const visibleMessages = messages.filter(m => getTextParts(m.parts).length > 0);
    const isWaiting = status === 'submitted' || status === 'streaming';
    const lastMessage = messages[messages.length - 1];
    const lastMessageHasText = getTextParts(lastMessage?.parts).length > 0;
    const showTypingIndicator = isWaiting && (lastMessage?.role !== 'assistant' || !lastMessageHasText);

    const {
        control,
        handleSubmit,
        reset,
        watch,
        formState: { errors },
    } = useForm<Inputs>({ defaultValues: { message: '' } });

    const messageValue = watch('message');
    const isMessageEmpty = !messageValue?.trim();

    const onSubmit: SubmitHandler<Inputs> = (data) => {
        if (!data.message.trim()) return;
        sendMessage({
            text: data.message.trim(),
        });

        contentRef.current?.scrollToBottom();
        reset();
    }

    useEffect(() => {
        (async () => {
            await supabase.auth.refreshSession();
        })();
    }, []);

    return (
        <IonPage>
            <IonHeader className="ion-no-border">
                <IonToolbar color={'light'} className='borderless'>
                    <IonButtons slot="start" className="ion-padding-start">
                        <IonBackButton defaultHref="/dashboard" />
                    </IonButtons>
                    <IonTitle className="text-base text-center fixed left-6 right-6 top-0 bottom-0 text-lg">
                        {name}
                    </IonTitle>
                </IonToolbar>
            </IonHeader>

            <IonContent ref={contentRef} color={'light'} className='ion-padding'>
                <div className='flex flex-col gap-4'>
                    {visibleMessages.map(m => (
                        <div key={m.id} className='block'>
                            {m.role === 'user' && (
                                <div className='flex w-full justify-end user-box'>
                                    <div className="bg-neutral-200 rounded-4xl max-w-[80%] p-3">
                                        {getTextParts(m.parts).map((part, i) => (
                                            <div key={i} className='text-sm'>
                                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                    {part.text}
                                                </ReactMarkdown>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {m.role === 'assistant' && (
                                <div className='block message-box'>
                                    {getTextParts(m.parts).map((part, i) => (
                                        <div key={i} className='text-sm'>
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                {part.text}
                                            </ReactMarkdown>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}

                    {showTypingIndicator && (
                        <div className="typing-indicator">
                            <span></span>
                            <span></span>
                            <span></span>
                        </div>
                    )}
                </div>
                {error && <IonText color="danger">{error.message}</IonText>}
                <div ref={messagesEndRef} />
            </IonContent>

            <IonFooter color='light' className='ion-no-border ion-no-background chat-footer'>
                <div className='ion-padding'>
                    <div className='bg-white rounded-3xl shadow-lg'>
                        <form onSubmit={handleSubmit(onSubmit)}>
                            <Controller
                                name="message"
                                control={control}
                                render={({ field }) => (
                                    <IonTextarea
                                        className='clear-input px-3'
                                        autoGrow={true}
                                        value={field.value}
                                        onIonInput={(e) => field.onChange(e.detail.value ?? '')}
                                        onIonBlur={field.onBlur}
                                        rows={1}
                                        placeholder='Ask anything about your notes...'
                                    />
                                )}
                            />

                            <div className='px-2 pb-2 flex justify-end'>
                                {(status !== 'streaming' && status !== 'submitted') && (
                                    <IonButton
                                        type='submit'
                                        mode="ios"
                                        shape='round'
                                        disabled={isWaiting || isMessageEmpty}
                                        color='dark'
                                    >
                                        <IonIcon icon={arrowUp} slot='icon-only' />
                                    </IonButton>
                                )}

                                {(status === 'submitted' || status === 'streaming') && (
                                    <IonButton
                                        color='danger'
                                        mode="ios"
                                        shape='round'
                                        type="button"
                                        onClick={() => stop()}
                                    >
                                        <IonIcon icon={stopSharp} slot='icon-only' />
                                    </IonButton>
                                )}
                            </div>
                        </form>
                    </div>
                </div>
            </IonFooter>
        </IonPage>
    );
};

export default ChatbotPage;