import { useCallback, useEffect, useRef, useState } from 'react';

const THINKING_MS = 650;

let counter = 0;
const nextId = () => `msg-${Date.now()}-${counter++}`;

/**
 * Chat state machine: user message → "typing…" placeholder → assistant reply.
 * All timeouts are tracked in a ref and cleared on unmount, so navigating away cannot update
 * state on an unmounted component.
 *
 * `intro` may be a string or a { text, options } object; options are rendered inside the transcript
 * as clickable questions.
 */
export default function useChat({ intro, resolve }) {
  // Frozen on first render so the reset handler stays stable. `intro` may be a string or an object.
  const [introMessage] = useState(() => (typeof intro === 'string' ? { text: intro } : intro));
  const buildIntro = useCallback(
    () => ({ id: nextId(), role: 'assistant', ...introMessage }),
    [introMessage],
  );

  const [messages, setMessages] = useState(() => [buildIntro()]);
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
    setMessages([buildIntro()]);
  }, [buildIntro]);

  return { messages, pending, send, reset };
}
