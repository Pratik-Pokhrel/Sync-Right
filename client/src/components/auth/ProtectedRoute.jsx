import { Navigate } from 'react-router-dom';
import { tokenStorage } from '../../utils/tokenStorage';

const ProtectedRoute = ({ element }) => {
  const hasToken = tokenStorage.hasToken();

  if (!hasToken) {
    // Redirect to login if user is not authenticated
    return <Navigate to="/login" replace />;
  }

  return element;
};

export default ProtectedRoute;
