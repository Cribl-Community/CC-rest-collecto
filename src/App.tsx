import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { WizardProvider } from './context/WizardContext';
import { Stepper } from './components/Stepper';
import { SpecInputPage } from './pages/SpecInputPage';
import { EndpointSelectPage } from './pages/EndpointSelectPage';
import { CollectorConfigPage } from './pages/CollectorConfigPage';
import { SchedulePage } from './pages/SchedulePage';
import { ReviewPage } from './pages/ReviewPage';
import './App.css';

declare const CRIBL_BASE_PATH: string | undefined;

function Layout() {
  const location = useLocation();
  const isHome = location.pathname === '/' || location.pathname === '';

  if (isHome) return null;

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-logo">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="11" stroke="#00C58E" strokeWidth="2"/>
            <path d="M7 12h10M12 7l5 5-5 5" stroke="#00C58E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>REST Collecto</span>
        </div>
        <Stepper currentPath={location.pathname} />
      </header>
      <main className="app-main">
        <Routes>
          <Route path="/spec" element={<SpecInputPage />} />
          <Route path="/endpoint" element={<EndpointSelectPage />} />
          <Route path="/configure" element={<CollectorConfigPage />} />
          <Route path="/schedule" element={<SchedulePage />} />
          <Route path="/review" element={<ReviewPage />} />
          <Route path="*" element={<Navigate to="/spec" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function HomeRedirect() {
  return <Navigate to="/spec" replace />;
}

function App() {
  const base =
    typeof CRIBL_BASE_PATH !== 'undefined' ? CRIBL_BASE_PATH : '/';

  return (
    <BrowserRouter basename={base}>
      <WizardProvider>
        <Routes>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/*" element={<Layout />} />
        </Routes>
      </WizardProvider>
    </BrowserRouter>
  );
}

export default App;
