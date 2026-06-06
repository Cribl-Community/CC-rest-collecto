import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { WizardProvider } from './context/WizardContext';
import { Stepper } from './components/Stepper';
import { SpecInputPage } from './pages/SpecInputPage';
import { EndpointSelectPage } from './pages/EndpointSelectPage';
import { CollectorConfigPage } from './pages/CollectorConfigPage';
import { SchedulePage } from './pages/SchedulePage';
import { ReviewPage } from './pages/ReviewPage';
import { ChatPage } from './pages/ChatPage';
import { SettingsPage } from './pages/SettingsPage';
import './App.css';

declare const CRIBL_BASE_PATH: string | undefined;

const WIZARD_PATHS = ['/spec', '/endpoint', '/configure', '/schedule', '/review'];

function ChatIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2 3a1 1 0 011-1h10a1 1 0 011 1v7a1 1 0 01-1 1H9l-3 2v-2H3a1 1 0 01-1-1V3z"
        stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M5 6h6M5 8.5h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function HeaderNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const isChat = location.pathname.startsWith('/chat');
  const isSettings = location.pathname.startsWith('/settings');

  return (
    <div className="header-nav">
      <button
        type="button"
        className={`header-nav-btn${isChat ? ' header-nav-btn--active' : ''}`}
        onClick={() => navigate('/chat')}
        title="AI Collector Builder"
      >
        <ChatIcon />
        <span>AI Builder</span>
      </button>
      <button
        type="button"
        className={`header-nav-btn${isSettings ? ' header-nav-btn--active' : ''}`}
        onClick={() => navigate('/settings')}
        title="Settings"
      >
        <SettingsIcon />
      </button>
    </div>
  );
}

function Layout() {
  const location = useLocation();
  const isWizard = WIZARD_PATHS.some(p => location.pathname.startsWith(p));
  const isChat = location.pathname.startsWith('/chat');

  if (isChat) {
    return (
      <div className="app-shell app-shell--chat">
        <Routes>
          <Route path="/chat" element={<ChatPage />} />
          <Route path="*" element={<Navigate to="/spec" replace />} />
        </Routes>
      </div>
    );
  }

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
        {isWizard && <Stepper currentPath={location.pathname} />}
        <HeaderNav />
      </header>
      <main className="app-main">
        <Routes>
          <Route path="/spec" element={<SpecInputPage />} />
          <Route path="/endpoint" element={<EndpointSelectPage />} />
          <Route path="/configure" element={<CollectorConfigPage />} />
          <Route path="/schedule" element={<SchedulePage />} />
          <Route path="/review" element={<ReviewPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/spec" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  const base =
    typeof CRIBL_BASE_PATH !== 'undefined' ? CRIBL_BASE_PATH : '/';

  return (
    <BrowserRouter basename={base}>
      <WizardProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/spec" replace />} />
          <Route path="/*" element={<Layout />} />
        </Routes>
      </WizardProvider>
    </BrowserRouter>
  );
}

export default App;
