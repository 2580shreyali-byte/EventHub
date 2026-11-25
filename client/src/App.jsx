import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { Navbar } from './components/common/Navbar.jsx';
import { Footer } from './components/common/Footer.jsx';
import { ProtectedRoute } from './components/common/ProtectedRoute.jsx';

// Pages
import { LandingPage } from './pages/LandingPage.jsx';
import { LoginPage } from './pages/auth/LoginPage.jsx';
import { RegisterPage } from './pages/auth/RegisterPage.jsx';
import { ExploreEventsPage } from './pages/student/ExploreEventsPage.jsx';
import { EventDetailsPage } from './pages/student/EventDetailsPage.jsx';
import { StudentDashboardPage } from './pages/student/StudentDashboardPage.jsx';
import { MyPassesPage } from './pages/student/MyPassesPage.jsx';
import { InvitationsPage } from './pages/student/InvitationsPage.jsx';
import { StudentProfilePage } from './pages/student/StudentProfilePage.jsx';

// Admin Pages
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage.jsx';
import { CreateEventPage } from './pages/admin/CreateEventPage.jsx';
import { EditEventPage } from './pages/admin/EditEventPage.jsx';
import { GateScannerPage } from './pages/admin/GateScannerPage.jsx';
import { QueueLessPage } from './pages/admin/QueueLessPage.jsx';

export function App() {
  return (
    <Router>
      <AuthProvider>
        <div className="min-h-screen flex flex-col bg-[#FAF9FC] text-[#24212B]">
          <Navbar />
          <main className="flex-1">
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/events" element={<ExploreEventsPage />} />
              <Route path="/events/:id" element={<EventDetailsPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />

              {/* Student Protected Routes */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute allowedRole="student">
                    <StudentDashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/my-passes"
                element={
                  <ProtectedRoute allowedRole="student">
                    <MyPassesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/invitations"
                element={
                  <ProtectedRoute allowedRole="student">
                    <InvitationsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profile"
                element={
                  <ProtectedRoute allowedRole="student">
                    <StudentProfilePage />
                  </ProtectedRoute>
                }
              />

              {/* Admin Protected Routes */}
              <Route
                path="/admin"
                element={
                  <ProtectedRoute allowedRole="admin">
                    <AdminDashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/events/new"
                element={
                  <ProtectedRoute allowedRole="admin">
                    <CreateEventPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/events/:id/edit"
                element={
                  <ProtectedRoute allowedRole="admin">
                    <EditEventPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/scanner"
                element={
                  <ProtectedRoute allowedRole="admin">
                    <GateScannerPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/queueless"
                element={
                  <ProtectedRoute allowedRole="admin">
                    <QueueLessPage />
                  </ProtectedRoute>
                }
              />

              {/* Catch-all */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
          <Footer />
        </div>
      </AuthProvider>
    </Router>
  );
}

export default App;
