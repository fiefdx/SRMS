import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useApp } from '../hooks/useApp';
import ChatLauncher from './ChatLauncher';
import ChatPanel from './ChatPanel';

/**
 * Renders the assistant window and its floating button. The open state lives in the app store
 * (assistantOpen) so a page can open it too — see the "Ask the AI assistant" button on the home page.
 * Hidden in the admin area and closed by Escape.
 */
export default function ChatDock() {
  const { pathname } = useLocation();
  const { assistantOpen, closeAssistant, toggleAssistant } = useApp();
  const hiddenOn = pathname.startsWith('/admin');

  useEffect(() => {
    if (hiddenOn && assistantOpen) closeAssistant();
  }, [hiddenOn, assistantOpen, closeAssistant]);

  useEffect(() => {
    if (!assistantOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') closeAssistant();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [assistantOpen, closeAssistant]);

  if (hiddenOn) return null;

  return (
    <>
      {assistantOpen && <ChatPanel onClose={closeAssistant} />}
      <ChatLauncher open={assistantOpen} onToggle={toggleAssistant} />
    </>
  );
}
