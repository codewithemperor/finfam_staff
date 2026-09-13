import { Alert } from "@heroui/react";

import type { OrientationBlock } from "@/config/orientation";

/**
 * Renders orientation content blocks as plain, readable typography —
 * headings, paragraphs and lists separated by whitespace, not nested cards.
 * The two block-level Alerts carry the only persistent warnings in the
 * workshop (finalising rewards, fraud policy).
 */
export function OrientationContent({ blocks }: { blocks: OrientationBlock[] }) {
  return (
    <div className="flex flex-col">
      {blocks.map((block, index) => {
        switch (block.type) {
          case "heading":
            return (
              <h2
                key={index}
                className="mt-8 text-base font-semibold tracking-tight text-foreground first:mt-0"
              >
                {block.text}
              </h2>
            );
          case "paragraph":
            return (
              <p
                key={index}
                className="mt-4 text-[15px] leading-7 text-foreground first:mt-0"
              >
                {block.text}
              </p>
            );
          case "list":
            return (
              <ul
                key={index}
                className="mt-4 list-disc space-y-2.5 pl-5 text-[15px] leading-7 text-foreground first:mt-0"
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
                className="mt-6 first:mt-0"
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
