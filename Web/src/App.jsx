import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { AuthProvider } from '@/contexts/AuthContext'
import ProtectedRoute from '@/components/layout/ProtectedRoute'
import AppLayout from '@/components/layout/AppLayout'
import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import FeedbacksPage from '@/pages/FeedbacksPage'
import FeedbackDetailPage from '@/pages/FeedbackDetailPage'
import UsersPage from '@/pages/UsersPage'
import UserFormPage from '@/pages/UserFormPage'
import SettingsPage from '@/pages/SettingsPage'
import MessagesPage from '@/pages/MessagesPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route index element={<Navigate to="/messages" replace />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/feedbacks" element={<FeedbacksPage />} />
                <Route path="/feedbacks/:id" element={<FeedbackDetailPage />} />
                <Route path="/users" element={<UsersPage />} />
                <Route path="/users/new" element={<UserFormPage />} />
                <Route path="/users/:id/edit" element={<UserFormPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/messages" element={<MessagesPage />} />
              </Route>
            </Route>
          </Routes>
          <Toaster position="top-right" richColors closeButton />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
