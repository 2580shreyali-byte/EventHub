import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { Loader2 } from 'lucide-react';

export function ProtectedRoute({ children, allowedRole }) {
  const { user, loading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#6D28D9] animate-spin mb-3" />
        <p className="text-sm text-[#777180]">Verifying campus authentication...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRole && user.role !== allowedRole) {
    // If student attempts to access admin route, redirect to student dashboard
    if (user.role === 'student' && allowedRole === 'admin') {
      return <Navigate to="/dashboard" replace />;
    }
    // If admin attempts to access student dashboard, redirect to admin dashboard
    if (user.role === 'admin' && allowedRole === 'student') {
      return <Navigate to="/admin" replace />;
    }
  }

  return children;
}
