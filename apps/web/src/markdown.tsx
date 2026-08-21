import { Fragment, type ReactNode } from 'react';

const BULLET = /^(\s*)([-*]|\d+\.)\s+/;

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

    if (BULLET.test(line)) {
      const block: string[] = [];
      while (i < lines.length && lines[i].trim() !== '') block.push(lines[i++]);
      i--;
      blocks.push(<Fragment key={i}>{list(block)}</Fragment>);
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

/**
 * One list, plus any list nested under it. A line without a bullet continues
 * the item above it, and a bullet indented further than the first one opens a
 * nested list, which is how the generated documents wrap long items.
 */
function list(lines: string[]): ReactNode {
  const first = BULLET.exec(lines[0]);
  if (!first) return null;
  const indent = first[1].length;
  const ordered = /\d/.test(first[2]);
  const items: { text: string; nested: string[] }[] = [];

  for (const line of lines) {
    const bullet = BULLET.exec(line);
    const item = items[items.length - 1];
    if (bullet && bullet[1].length <= indent) items.push({ text: line.slice(bullet[0].length), nested: [] });
    else if (!item) continue;
    else if (bullet) item.nested.push(line.slice(indent));
    else if (item.nested.length > 0) item.nested.push(line.slice(indent));
    else item.text += ` ${line.trim()}`;
  }

  const List = ordered ? 'ol' : 'ul';
  return (
    <List>
      {items.map((item, index) => (
        <li key={index}>
          {inline(item.text)}
          {item.nested.length > 0 ? list(item.nested) : null}
        </li>
      ))}
    </List>
  );
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
