import React, { useEffect, useRef } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

type Part =
  | { type: 'text'; content: string }
  | { type: 'inline'; content: string }
  | { type: 'display'; content: string };

/**
 * Splits a string into text and math segments.
 * Handles: $$...$$, \[...\], $...$, \(...\)
 * Uses capture groups so inner content is extracted correctly.
 */
function splitLatex(text: string): Part[] {
  const parts: Part[] = [];
  // Each group captures the INNER content (no delimiters).
  // Group 1 = $$...$$ display
  // Group 2 = \[...\] display
  // Group 3 = $...$ inline  (excludes $ and newlines inside)
  // Group 4 = \(...\) inline
  const re = /\$\$([\s\S]*?)\$\$|\\\[([\s\S]*?)\\\]|\$([^$\r\n]+?)\$|\\\(([\s\S]*?)\\\)/g;
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      parts.push({ type: 'text', content: text.slice(last, m.index) });
    }

    if (m[1] !== undefined) {
      parts.push({ type: 'display', content: m[1].trim() });
    } else if (m[2] !== undefined) {
      parts.push({ type: 'display', content: m[2].trim() });
    } else if (m[3] !== undefined) {
      parts.push({ type: 'inline', content: m[3].trim() });
    } else if (m[4] !== undefined) {
      parts.push({ type: 'inline', content: m[4].trim() });
    }

    last = m.index + m[0].length;
  }

  if (last < text.length) {
    parts.push({ type: 'text', content: text.slice(last) });
  }

  return parts;
}

function KatexSpan({ latex, display }: { latex: string; display: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    try {
      katex.render(latex, ref.current, {
        displayMode: display,
        throwOnError: false,
        strict: false,
        trust: true,
      });
    } catch {
      if (ref.current) ref.current.textContent = latex;
    }
  }, [latex, display]);

  return (
    <span
      ref={ref}
      className={display ? 'block my-2 overflow-x-auto text-center' : 'inline-block align-middle'}
    />
  );
}

interface MathTextProps {
  children: string | null | undefined;
  className?: string;
  block?: boolean;
}

export function MathText({ children, className = '', block = false }: MathTextProps) {
  if (!children) return null;

  const parts = splitLatex(children);
  const hasDisplay = parts.some(p => p.type === 'display');
  const Tag = block || hasDisplay ? 'div' : 'span';

  return (
    <Tag className={className}>
      {parts.map((part, i) => {
        if (part.type === 'text') {
          return (
            <span key={i} style={{ whiteSpace: 'pre-wrap' }}>
              {part.content}
            </span>
          );
        }
        return (
          <KatexSpan
            key={i}
            latex={part.content}
            display={part.type === 'display'}
          />
        );
      })}
    </Tag>
  );
}
