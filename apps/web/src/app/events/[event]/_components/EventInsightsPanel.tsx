import type { ReactNode } from "react";

interface EventInsightsPanelProps {
  sections: Array<ReactNode | null | false | undefined>;
  title?: string;
  description?: string;
}

export function EventInsightsPanel({
  sections,
  title,
  description,
}: EventInsightsPanelProps) {
  const visibleSections = sections.filter(Boolean) as ReactNode[];
  if (visibleSections.length === 0) return null;

  return (
    <div className="container mx-auto mt-8 px-1 md:px-4">
      <section className="border-border/60 bg-muted/30 overflow-hidden rounded-3xl border p-4 shadow-sm md:p-6">
        {/* <div className="space-y-1">
          {title ? (
            <h2 className="text-base font-semibold md:text-xl">{title}</h2>
          ) : null}
          {description ? (
            <p className="text-muted-foreground text-sm md:text-base">
              {description}
            </p>
          ) : null}
        </div> */}
        <div className="grid gap-4 md:gap-6">
          {visibleSections.map((section, index) => (
            <div key={index}>{section}</div>
          ))}
        </div>
      </section>
    </div>
  );
}
