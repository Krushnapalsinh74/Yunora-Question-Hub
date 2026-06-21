import React from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface MathSegment {
  type: 'text' | 'inline-math' | 'display-math';
  content: string;
}

function parseSegments(text: string): MathSegment[] {
  const segments: MathSegment[] = [];
  // Order matters: $$ before $, \[ before \(
  const pattern = /(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\$[^$\n]*?\$|\\\([\s\S]*?\\\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }

    const raw = match[0];
    if (raw.startsWith('$$') || raw.startsWith('\\[')) {
      const inner = raw.startsWith('$$')
        ? raw.slice(2, -2)
        : raw.slice(2, -2);
      segments.push({ type: 'display-math', content: inner.trim() });
    } else {
      const inner = raw.startsWith('$')
        ? raw.slice(1, -1)
        : raw.slice(2, -2);
      segments.push({ type: 'inline-math', content: inner.trim() });
    }

    lastIndex = match.index + raw.length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', content: text.slice(lastIndex) });
  }

  return segments;
}

function renderKatex(latex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(latex, {
      displayMode,
      throwOnError: false,
      strict: false,
      trust: true,
      macros: {
        '\\therefore': '\\mathrel{\\therefore}',
        '\\because': '\\mathrel{\\because}',
      },
    });
  } catch {
    return `<span style="color: red; font-family: monospace;">${latex}</span>`;
  }
}

interface MathTextProps {
  children: string | null | undefined;
  className?: string;
  block?: boolean;
}

export function MathText({ children, className = '', block = false }: MathTextProps) {
  if (!children) return null;

  const segments = parseSegments(children);

  const hasDisplay = segments.some(s => s.type === 'display-math');
  const Tag = (block || hasDisplay) ? 'div' : 'span';

  return (
    <Tag className={className}>
      {segments.map((seg, i) => {
        if (seg.type === 'text') {
          return <span key={i} style={{ whiteSpace: 'pre-wrap' }}>{seg.content}</span>;
        }
        const html = renderKatex(seg.content, seg.type === 'display-math');
        return (
          <span
            key={i}
            dangerouslySetInnerHTML={{ __html: html }}
            className={seg.type === 'display-math' ? 'block my-2 overflow-x-auto' : 'inline'}
          />
        );
      })}
    </Tag>
  );
}
