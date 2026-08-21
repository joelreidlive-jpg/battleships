import { Fragment, type ReactNode } from 'react';

/**
 * A deliberately small Markdown renderer, covering exactly what the generated
 * documentation uses: headings, paragraphs, lists, tables, fenced code and
 * inline emphasis. It exists so the published documents can be rendered inside
 * the game without adding a dependency, and it takes no HTML input — the
 * source is generated from the codebase, and nothing here interprets tags.
 */
export function Markdown({ source }: { source: string }): ReactNode {
  const blocks: ReactNode[] = [];
  const lines = source.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '') continue;

    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      const Tag = `h${heading[1].length}` as 'h1' | 'h2' | 'h3' | 'h4';
      blocks.push(<Tag key={i}>{inline(heading[2])}</Tag>);
      continue;
    }

    if (line.startsWith('```')) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) code.push(lines[i++]);
      blocks.push(
        <pre key={i}>
          <code>{code.join('\n')}</code>
        </pre>,
      );
      continue;
    }

    if (line.startsWith('|')) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].startsWith('|')) {
        const cells = lines[i]
          .slice(1, lines[i].endsWith('|') ? -1 : undefined)
          .split('|')
          .map((cell) => cell.trim());
        if (!cells.every((cell) => /^:?-{2,}:?$/.test(cell))) rows.push(cells);
        i++;
      }
      i--;
      const [header, ...body] = rows;
      blocks.push(
        <table key={i}>
          <thead>
            <tr>
              {header.map((cell, index) => (
                <th key={index}>{inline(cell)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, index) => (
                  <td key={index}>{inline(cell)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>,
      );
      continue;
    }

    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*([-*]|\d+\.)\s+/, ''));
        i++;
      }
      i--;
      const List = ordered ? 'ol' : 'ul';
      blocks.push(
        <List key={i}>
          {items.map((item, index) => (
            <li key={index}>{inline(item)}</li>
          ))}
        </List>,
      );
      continue;
    }

    const paragraph: string[] = [];
    while (i < lines.length && lines[i].trim() !== '' && !/^[#|`]|^\s*([-*]|\d+\.)\s/.test(lines[i])) {
      paragraph.push(lines[i++]);
    }
    i--;
    blocks.push(<p key={i}>{inline(paragraph.join(' '))}</p>);
  }

  return <>{blocks}</>;
}

/** `**bold**`, `*italic*` and `` `code` ``. Everything else is literal text. */
function inline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g).filter(Boolean);
  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) return <strong key={index}>{part.slice(2, -2)}</strong>;
        if (part.startsWith('`') && part.endsWith('`')) return <code key={index}>{part.slice(1, -1)}</code>;
        if (part.startsWith('*') && part.endsWith('*')) return <em key={index}>{part.slice(1, -1)}</em>;
        return <Fragment key={index}>{part}</Fragment>;
      })}
    </>
  );
}
