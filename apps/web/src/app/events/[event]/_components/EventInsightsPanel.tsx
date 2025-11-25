import type { ReactNode } from "react";

interface EventInsightsPanelProps {
  sections?: Array<ReactNode | null | false | undefined>;
  children?: ReactNode;
  title?: string;
  description?: string;
}

export function EventInsightsPanel({
  sections,
  children,
  title,
  description,
}: EventInsightsPanelProps) {
  const normalizedSections =
    sections?.filter(Boolean) ??
    (Array.isArray(children) ? children : [children]);

  const visibleSections = normalizedSections.filter(Boolean);

  if (visibleSections.length === 0) return null;

  return (
    <div className="container mx-auto my-8 px-1 md:px-4">
      <section className="border-border/60 bg-muted/30 overflow-hidden rounded-3xl border p-2 shadow-sm md:p-4">
        {title || description ? (
          <div className="mb-4 space-y-1">
            {title ? (
              <h2 className="text-base font-semibold md:text-xl">{title}</h2>
            ) : null}
            {description ? (
              <p className="text-muted-foreground text-sm md:text-base">
                {description}
              </p>
            ) : null}
          </div>
        ) : null}
        <div className="grid gap-2 md:gap-4">
          {visibleSections.map((section, index) => (
            <div key={index}>{section}</div>
          ))}
        </div>
      </section>
    </div>
  );
}
