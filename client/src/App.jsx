import { BrowserRouter as Router } from 'react-router-dom';
import AllRoutes from './routes/AllRoutes';
import './App.css';

function App() {
  return (
    <Router>
      <AllRoutes />
    </Router>
  );
}

export default App;
