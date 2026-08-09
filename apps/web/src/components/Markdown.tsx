import {
  tokenizeMarkdown,
  type InlineToken,
  type BlockToken,
} from "@/lib/markdown";

function Inline({ tokens }: { tokens: InlineToken[] }) {
  return (
    <>
      {tokens.map((token, index) => {
        switch (token.type) {
          case "text":
            return <span key={index}>{token.text}</span>;
          case "code":
            return <code key={index}>{token.text}</code>;
          case "bold":
            return <strong key={index}><Inline tokens={token.children} /></strong>;
          case "italic":
            return <em key={index}><Inline tokens={token.children} /></em>;
          case "link":
            return (
              <a key={index} href={token.href} target="_blank" rel="noopener noreferrer">
                <Inline tokens={token.children} />
              </a>
            );
          default:
            return null;
        }
      })}
    </>
  );
}

function Block({ block, index }: { block: BlockToken; index: number }) {
  switch (block.type) {
    case "heading": {
      const Heading = `h${Math.min(Math.max(block.level, 1), 6)}` as "h1";
      return (
        <Heading key={index}>
          <Inline tokens={block.children} />
        </Heading>
      );
    }
    case "paragraph":
      return (
        <p key={index}>
          <Inline tokens={block.children} />
        </p>
      );
    case "code":
      return (
        <pre key={index}>
          <code>{block.code}</code>
        </pre>
      );
    case "quote":
      return (
        <blockquote key={index}>
          <Inline tokens={block.children} />
        </blockquote>
      );
    case "list": {
      const List = block.ordered ? "ol" : "ul";
      return (
        <List key={index}>
          {block.items.map((item, itemIndex) => (
            <li key={itemIndex}>
              <Inline tokens={item.children} />
            </li>
          ))}
        </List>
      );
    }
    case "hr":
      return <hr key={index} />;
    default:
      return null;
  }
}

export function Markdown({ source }: { source: string }) {
  const blocks = tokenizeMarkdown(source);
  if (blocks.length === 0) {
    return <p className="muted">No content.</p>;
  }
  return (
    <div className="markdown">
      {blocks.map((block, index) => (
        <Block key={index} block={block} index={index} />
      ))}
    </div>
  );
}
