import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import LoginPage from '@/pages/LoginPage';
import ForgotPasswordPage from '@/pages/ForgotPasswordPage';
import DashboardPage from '@/pages/DashboardPage';
import { IntegrationTestPage } from '@/pages/IntegrationTest';
import AdminLayout from '@/components/layout/AdminLayout';

// Placeholder pages for other routes
const DocumentsPage = () => <div className="p-6">Documents Page - Em desenvolvimento</div>;
const UsersPage = () => <div className="p-6">Users Page - Em desenvolvimento</div>;
const OrdersPage = () => <div className="p-6">Orders Page - Em desenvolvimento</div>;
const ReportsPage = () => <div className="p-6">Reports Page - Em desenvolvimento</div>;
const ProfilePage = () => <div className="p-6">Profile Page - Em desenvolvimento</div>;
const SettingsPage = () => <div className="p-6">Settings Page - Em desenvolvimento</div>;

function App() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route 
        path="/login" 
        element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />} 
      />
      <Route 
        path="/forgot-password" 
        element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <ForgotPasswordPage />} 
      />
      
      {/* Protected routes with AdminLayout */}
      <Route 
        element={isAuthenticated ? <AdminLayout /> : <Navigate to="/login" replace />}
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/integration-test" element={<IntegrationTestPage />} />
        <Route path="/documents" element={<DocumentsPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      
      {/* Redirect root to appropriate page */}
      <Route 
        path="/" 
        element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />} 
      />
      
      {/* 404 fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;