import { Routes, Route, Navigate } from 'react-router-dom';
import Login from '../pages/Login';
import Register from '../pages/Register';
import Dashboard from '../pages/Dashboard';
import OauthCallback from '../pages/OauthCallback';
import ProtectedRoute from '../components/auth/ProtectedRoute';
import AdminDashboard from '../pages/AdminDashboard';
import AdminUsers from '../pages/AdminUsers';

const AllRoutes = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/oauth/callback" element={<OauthCallback />} />
      <Route path="/dashboard" element={<ProtectedRoute element={<Dashboard />} />} />
      <Route
        path="/admin"
        element={<ProtectedRoute element={<AdminDashboard />} allowedRoles={["admin"]} />}
      />
      <Route
        path="/admin/users"
        element={<ProtectedRoute element={<AdminUsers />} allowedRoles={["admin"]} />}
      />
      <Route path="/" element={<Navigate to="/login" replace />} />
    </Routes>
  );
};

export default AllRoutes;