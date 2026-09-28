// PublicRoute.tsx
import { Navigate, matchPath, useLocation } from 'react-router';
import { useAuth } from '../utils/authContext';

// path yang tetap boleh diakses walau user sudah login
const AUTHENTICATED_ALLOWED_PATHS = ['/chatbot/u/*'];

const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { isAuthenticated, isLoading } = useAuth();
    const location = useLocation();
    const from = (location.state as { from?: string } | null)?.from;

    const isExempt = AUTHENTICATED_ALLOWED_PATHS.some((pattern) =>
        matchPath(pattern, location.pathname)
    );

    // dicek paling awal, jadi tidak perlu menunggu isLoading
    if (isExempt) return <>{children}</>;

    if (isLoading) return null;
    if (isAuthenticated) return <Navigate to={from ?? '/dashboard'} replace />;

    return <>{children}</>;
};

export default PublicRoute;