import { Link, useLocation } from 'react-router-dom';

/**
 * Floating shortcut to the AI assistant: icon only, bottom-right, hidden on the chat page itself and
 * in the admin area. Text stays in aria-label/title so screen readers still announce it.
 */
export default function ChatLauncher() {
  const { pathname } = useLocation();
  if (pathname === '/chat' || pathname.startsWith('/admin')) return null;

  return (
    <Link
      className="chat-launcher"
      to="/chat"
      aria-label="Ask the AI assistant"
      title="Ask the AI assistant"
    >
      💬
    </Link>
  );
}
