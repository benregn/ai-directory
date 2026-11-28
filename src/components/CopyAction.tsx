import { useEffect, useRef, useState } from 'react';

/**
 * Clipboard write with the legacy fallback, honest both ways: the promise
 * resolves false rather than throwing when neither path can write.
 */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.append(area);
    area.select();
    let copied = false;
    try {
      copied = document.execCommand('copy');
    } catch {
      // execCommand is itself the fallback: failing here means failing honestly
    }
    area.remove();
    return copied;
  }
}

/**
 * Copy-to-clipboard action with feedback in the label itself — print
 * furniture, no new chrome. Failure is honest too: a copy that never
 * reached the clipboard must not report success. The visual treatment is
 * the caller's, through className: the action reads as the register's text
 * actions do wherever it sits.
 */
export function CopyAction({
  label,
  text,
  disabled,
  title,
  className,
}: {
  label: string;
  /** Text to copy, or a thunk — Copy link reads the live URL at click time. */
  text: string | (() => string);
  disabled?: boolean;
  title?: string;
  className?: string;
}) {
  const [feedback, setFeedback] = useState<'copied' | 'failed' | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current !== null) {
        clearTimeout(timer.current);
      }
    },
    [],
  );
  async function press() {
    const copied = await copyText(typeof text === 'function' ? text() : text);
    setFeedback(copied ? 'copied' : 'failed');
    if (timer.current !== null) {
      clearTimeout(timer.current);
    }
    timer.current = setTimeout(() => setFeedback(null), 1500);
  }
  return (
    <button
      type="button"
      className={className}
      disabled={disabled}
      title={title}
      onClick={() => void press()}
    >
      {feedback === 'copied' ? 'Copied ✓' : feedback === 'failed' ? 'Copy failed' : label}
    </button>
  );
}
