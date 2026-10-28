import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../hooks/useApp';
import useChat from '../hooks/useChat';
import ChatBubble from './ChatBubble';
import { askAssistant, assistantIntro } from '../services/aiAssistant';
import { RESTAURANT_INFO } from '../data/aiKnowledgeBase';

/**
 * Pop-up assistant window (no separate page): a fixed panel above the floating chat button.
 *
 * Simulated locally for Assignment 1 (option 2 of the brief) — the engine combines the scripted
 * knowledge base with rule intents that read the live menu, the customer's order history and the
 * saved dietary preferences. In the final project the same call moves behind an AI service endpoint
 * on our Express backend, without changing this panel.
 */
export default function ChatPanel({ onClose }) {
  const { myOrders, menuItems, preferences } = useApp();
  const [question, setQuestion] = useState('');
  const logRef = useRef(null);
  const inputRef = useRef(null);

  const resolve = useCallback((text, context) => askAssistant(text, context), []);
  const intro = useMemo(() => assistantIntro(), []);
  const { messages, pending, send, reset } = useChat({ intro, resolve });

  // Context handed to the assistant engine: live menu, this customer's orders and saved preferences.
  const context = { menuItems, orders: myOrders, preferences };

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Keep the newest message in view.
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, pending]);

  const handleSubmit = (event) => {
    event.preventDefault();
    send(question, context);
    setQuestion('');
  };

  return (
    <section className="chat-panel" id="chat-panel" role="dialog" aria-label="AI Assistant">
      <div className="chat-panel-head">
        <h2>AI Assistant</h2>
        <div className="btn-row">
          <button className="btn small ghost" onClick={reset} title="Start a new conversation">
            New
          </button>
          <button className="chat-close" onClick={onClose} aria-label="Close the assistant" title="Close">
            ✕
          </button>
        </div>
      </div>

      <p className="chat-panel-sub small muted">Live menu, your orders, your preferences · simulated locally.</p>

      <div className="chat-log" ref={logRef}>
        {messages.map((message) => (
          <ChatBubble
            key={message.id}
            message={message}
            disabled={pending}
            onSelect={(question) => send(question, context)}
          />
        ))}
        {pending && <ChatBubble message={{ id: 'pending', role: 'typing', text: '…' }} />}
      </div>

      <form className="chat-input" onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          className="input"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask about specials, allergens, a budget…"
          aria-label="Ask the AI assistant"
        />
        <button className="btn primary" type="submit" disabled={pending || question.trim().length === 0}>
          Ask
        </button>
      </form>

      <p className="chat-disclaimer small muted">{RESTAURANT_INFO.disclaimer}</p>
    </section>
  );
}
