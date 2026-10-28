/**
 * Floating chat button: icon only, bottom-right. It toggles the pop-up assistant window instead of
 * navigating to a separate page. Props in / events out — ChatDock owns the open state.
 */
export default function ChatLauncher({ open, onToggle }) {
  return (
    <button
      type="button"
      className="chat-launcher"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls="chat-panel"
      aria-label={open ? 'Close the AI assistant' : 'Ask the AI assistant'}
      title="AI Assistant"
    >
      {open ? '✕' : '💬'}
    </button>
  );
}
