import React from 'react';
import { Navigate } from 'react-router';
import { useAuth } from '../utils/authContext';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { isAuthenticated, isLoading } = useAuth();

    if (isLoading) return null; // atau splash/loading screen

    if (!isAuthenticated) return <Navigate to="/" replace />;

    return <>{children}</>;
};

export default ProtectedRoute;