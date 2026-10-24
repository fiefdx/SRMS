import { useCallback, useEffect, useRef, useState } from 'react';

const THINKING_MS = 650;

let counter = 0;
const nextId = () => `msg-${Date.now()}-${counter++}`;

/**
 * Chat state machine: user message → "typing…" placeholder → assistant reply.
 * All timeouts are tracked in a ref and cleared on unmount, so navigating away cannot update
 * state on an unmounted component.
 */
export default function useChat({ intro, resolve }) {
  const [messages, setMessages] = useState(() => [
    { id: nextId(), role: 'assistant', text: intro },
  ]);
  const [pending, setPending] = useState(false);
  const timers = useRef([]);

  useEffect(() => {
    const pendingTimers = timers.current;
    return () => pendingTimers.forEach((timer) => window.clearTimeout(timer));
  }, []);

  const send = useCallback(
    (question, context) => {
      const trimmed = question.trim();
      if (!trimmed || pending) return;

      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: 'user', text: trimmed },
        { id: 'typing', role: 'typing', text: 'Checking the menu and your history…' },
      ]);
      setPending(true);

      const timer = window.setTimeout(() => {
        const answer = resolve(trimmed, context);
        setMessages((prev) => [
          ...prev.filter((message) => message.role !== 'typing'),
          { id: nextId(), role: 'assistant', ...answer },
        ]);
        setPending(false);
      }, THINKING_MS);

      timers.current.push(timer);
    },
    [pending, resolve],
  );

  const reset = useCallback(() => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
    setPending(false);
    setMessages([{ id: nextId(), role: 'assistant', text: intro }]);
  }, [intro]);

  return { messages, pending, send, reset };
}
