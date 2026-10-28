/**
 * Single chat message. Props only — the chat window owns the conversation state.
 *
 * When a message carries `options` (the pre-set question list the assistant attaches whenever it
 * cannot answer, and on the opening message) those questions are rendered inside the transcript as
 * clickable buttons, so the customer never has to type a question from scratch.
 */
export default function ChatBubble({ message, onSelect, disabled = false }) {
  const isUser = message.role === 'user';
  const isTyping = message.role === 'typing';
  const options = message.options ?? [];

  return (
    <div className={`bubble ${isUser ? 'user' : 'assistant'}${isTyping ? ' typing' : ''}`}>
      {message.text}

      {!isUser && !isTyping && options.length > 0 && (
        <div className="bubble-options">
          <span className="small muted">Pick one of these:</span>
          <div className="chip-row">
            {options.map((question) => (
              <button
                key={question}
                type="button"
                className="chip option"
                disabled={disabled}
                onClick={() => onSelect?.(question)}
              >
                {question}
              </button>
            ))}
          </div>
        </div>
      )}

      {!isUser && !isTyping && message.source && (
        <div className="small muted" style={{ marginTop: 4 }}>
          source: {message.source}
          {message.intent ? ` · ${message.intent}` : ''}
        </div>
      )}
    </div>
  );
}
