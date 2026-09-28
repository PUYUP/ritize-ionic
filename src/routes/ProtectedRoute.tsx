import React from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuth } from '../utils/authContext';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { isAuthenticated, isLoading } = useAuth();
    const location = useLocation();

    console.log('[ProtectedRoute]', location.pathname, { isAuthenticated, isLoading });

    if (isLoading) return null;
    if (!isAuthenticated) {
        return <Navigate to="/" replace state={{ from: location.pathname }} />;
    }

    return <>{children}</>;
};

export default ProtectedRoute;