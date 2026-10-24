import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '../hooks/useApp';
import useChat from '../hooks/useChat';
import ChatBubble from '../components/ChatBubble';
import { askAssistant, assistantIntro } from '../services/aiAssistant';
import { SUGGESTED_QUESTIONS, RESTAURANT_INFO } from '../data/aiKnowledgeBase';

export default function AIChat() {
  const { menuItems, orders, preferences, user } = useApp();
  const [question, setQuestion] = useState('');
  const logRef = useRef(null);

  const resolve = useCallback(
    (text, context) => askAssistant(text, context),
    [],
  );

  const { messages, pending, send, reset } = useChat({ intro: assistantIntro(), resolve });

  // Context handed to the assistant engine: live menu, order history and saved preferences.
  const context = {
    menuItems,
    orders: user ? orders.filter((order) => order.email === user.email) : orders,
    preferences,
  };

  // Keep the newest message in view.
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, pending]);

  const handleSubmit = (event) => {
    event.preventDefault();
    send(question, context);
    setQuestion('');
  };

  const askSuggested = (suggestion) => {
    send(suggestion, context);
  };

  return (
    <div className="container page">
      <div className="page-header">
        <div>
          <h1>AI Menu Assistant</h1>
          <p>
            Simulated locally for Assignment 1 (option 2 of the brief): the assistant combines a
            scripted question/answer knowledge base with rules that read the live menu, your order
            history and your saved dietary preferences. In the final project this same call is moved
            behind an AI service (Gemini / Groq / Ollama) on our own backend.
          </p>
        </div>
        <button className="btn small ghost" onClick={reset}>
          Start a new conversation
        </button>
      </div>

      <div className="split">
        <section className="card chat">
          <div className="chat-log" ref={logRef}>
            {messages.map((message) => (
              <ChatBubble key={message.id} message={message} />
            ))}
            {pending && <ChatBubble message={{ id: 'pending', role: 'typing', text: '…' }} />}
          </div>

          <form className="chat-input" onSubmit={handleSubmit}>
            <input
              className="input"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Ask about specials, allergens, a budget… e.g. “I want something spicy under $20”"
              aria-label="Ask the AI assistant"
            />
            <button className="btn primary" type="submit" disabled={pending || question.trim().length === 0}>
              Ask
            </button>
          </form>

          <div className="chip-row">
            {SUGGESTED_QUESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                className="chip"
                onClick={() => askSuggested(suggestion)}
                disabled={pending}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </section>

        <aside className="card">
          <h3>How this assistant works</h3>
          <p className="small muted">
            1. The question is normalised. 2. It is scored against the scripted knowledge base
            (specials, vegetarian, recommendations, gluten-free, popular dessert, previous order).
            3. Rule intents answer from live data: budget requests, spicy/vegan/dairy-free filters,
            allergens, prices, hours, delivery and reservations. 4. Unknown questions get a fallback.
          </p>

          <h3 style={{ marginTop: '1rem' }}>What it can answer</h3>
          <ul className="small muted">
            <li>Today&apos;s specials and popular dishes</li>
            <li>Vegetarian, vegan, gluten-free, dairy-free and spicy dishes</li>
            <li>“Something spicy under $20” style budget requests</li>
            <li>Ingredients and allergens (with a disclaimer)</li>
            <li>Price ranges, opening hours, delivery and pickup</li>
            <li>What you ordered last time</li>
          </ul>

          <p className="small muted" style={{ marginTop: '0.75rem' }}>{RESTAURANT_INFO.disclaimer}</p>
        </aside>
      </div>
    </div>
  );
}
