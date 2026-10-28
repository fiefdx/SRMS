import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ToastStack from './components/ToastStack';
import ChatDock from './components/ChatDock';
import { AppProvider } from './context/AppContext';
import { RESTAURANT_INFO } from './data/aiKnowledgeBase';
import './index.css';

// The restaurant brand comes from data/aiKnowledgeBase.js, so renaming it is a one-line change.
document.title = `${RESTAURANT_INFO.name} · SRMS — Smart Restaurant Management System`;

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AppProvider>
        <div className="app-shell">
          <Navbar />
          <main>
            <App />
          </main>
          <Footer />
          <ChatDock />
          <ToastStack />
        </div>
      </AppProvider>
    </BrowserRouter>
  </StrictMode>,
);
