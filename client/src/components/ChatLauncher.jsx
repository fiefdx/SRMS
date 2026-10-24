import { Link, useLocation } from 'react-router-dom';

/**
 * Floating shortcut to the AI assistant, hidden on the chat page itself and in the admin area.
 */
export default function ChatLauncher() {
  const { pathname } = useLocation();
  if (pathname === '/chat' || pathname.startsWith('/admin')) return null;

  return (
    <Link className="btn primary" to="/chat" style={{ position: 'fixed', left: '1rem', bottom: '1rem', zIndex: 30 }}>
      💬 Ask the AI assistant
    </Link>
  );
}
