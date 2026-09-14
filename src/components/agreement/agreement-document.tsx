import { Alert } from "@heroui/react";

import type { AgreementBlock } from "@/types/recruitment";

/**
 * Renders agreement content blocks as plain, readable document typography —
 * headings, paragraphs and lists separated by whitespace, not nested cards.
 * The single block-level Alert carries the reward-figures-pending notice.
 */
export function AgreementDocument({ blocks }: { blocks: AgreementBlock[] }) {
  return (
    <div className="flex flex-col">
      {blocks.map((block, index) => {
        switch (block.type) {
          case "heading":
            return (
              <h3
                key={index}
                className="mt-6 text-base font-semibold tracking-tight text-foreground first:mt-0"
              >
                {block.text}
              </h3>
            );
          case "paragraph":
            return (
              <p
                key={index}
                className="mt-4 max-w-[68ch] text-[15px] leading-7 text-foreground first:mt-0"
              >
                {block.text}
              </p>
            );
          case "list":
            return (
              <ul
                key={index}
                className="mt-4 max-w-[68ch] list-disc space-y-2.5 pl-5 text-[15px] leading-7 text-foreground first:mt-0"
              >
                {block.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            );
          case "alert":
            return (
              <Alert
                key={index}
                status={block.tone}
                className="mt-6 max-w-[68ch] first:mt-0"
              >
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>{block.title}</Alert.Title>
                  <Alert.Description>{block.text}</Alert.Description>
                </Alert.Content>
              </Alert>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
