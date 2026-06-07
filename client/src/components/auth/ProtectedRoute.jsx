import { Navigate } from 'react-router-dom';
import { tokenStorage } from '../../utils/tokenStorage';

const ProtectedRoute = ({ element, allowedRoles }) => {
  const hasToken = tokenStorage.hasToken();

  if (!hasToken) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && allowedRoles.length > 0) {
    const user = tokenStorage.getUser();
    if (!user || !allowedRoles.includes(user.role)) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return element;
};

export default ProtectedRoute;
