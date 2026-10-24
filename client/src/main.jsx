import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ToastStack from './components/ToastStack';
import ChatLauncher from './components/ChatLauncher';
import { AppProvider } from './context/AppContext';
import './index.css';

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
          <ChatLauncher />
          <ToastStack />
        </div>
      </AppProvider>
    </BrowserRouter>
  </StrictMode>,
);
