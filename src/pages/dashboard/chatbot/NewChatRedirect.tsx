import { useState } from 'react';
import { Navigate } from 'react-router';
import { generateId } from 'ai';

const NewChatRedirect: React.FC = () => {
    const [newId] = useState(() => generateId());
    return <Navigate to={`/dashboard/chatbot/c/${newId}`} replace />;
};

export default NewChatRedirect;