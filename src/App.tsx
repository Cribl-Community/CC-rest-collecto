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
import { ProjectsPage } from './pages/ProjectsPage';
import './App.css';

declare const CRIBL_BASE_PATH: string | undefined;

const WIZARD_PATHS = ['/spec', '/endpoint', '/configure', '/schedule', '/review'];

function ProjectsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="3" width="14" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M1 6h14" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M1 3.5L4 1h8l3 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M4 9h8M4 11.5h5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
}

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
  const isProjects = location.pathname.startsWith('/projects');

  return (
    <div className="header-nav">
      <button
        type="button"
        className={`header-nav-btn${isProjects ? ' header-nav-btn--active' : ''}`}
        onClick={() => navigate('/projects')}
        title="Projects"
      >
        <ProjectsIcon />
        <span>Projects</span>
      </button>
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
          <Route path="*" element={<Navigate to="/projects" replace />} />
        </Routes>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-logo">
          <span>REST Collecto</span>
        </div>
        <HeaderNav />
      </header>
      {isWizard && (
        <div className="app-subheader">
          <Stepper currentPath={location.pathname} />
        </div>
      )}
      <div className="app-main-wrapper">
        {isWizard && (
          <img src="/icon.png" className="app-wizard-icon" alt="REST Collecto" />
        )}
      <main className="app-main">
        <Routes>
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/spec" element={<SpecInputPage />} />
          <Route path="/endpoint" element={<EndpointSelectPage />} />
          <Route path="/configure" element={<CollectorConfigPage />} />
          <Route path="/schedule" element={<SchedulePage />} />
          <Route path="/review" element={<ReviewPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/projects" replace />} />
        </Routes>
      </main>
      </div>
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
          <Route path="/" element={<Navigate to="/projects" replace />} />
          <Route path="/*" element={<Layout />} />
        </Routes>
      </WizardProvider>
    </BrowserRouter>
  );
}

export default App;
