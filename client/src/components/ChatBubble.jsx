/** Single chat message. Props only — the chat page owns the conversation state. */
export default function ChatBubble({ message }) {
  const isUser = message.role === 'user';
  const isTyping = message.role === 'typing';

  return (
    <div className={`bubble ${isUser ? 'user' : 'assistant'}${isTyping ? ' typing' : ''}`}>
      {message.text}
      {!isUser && !isTyping && message.source && (
        <div className="small muted" style={{ marginTop: 4 }}>
          source: {message.source}
          {message.intent ? ` · ${message.intent}` : ''}
        </div>
      )}
    </div>
  );
}
