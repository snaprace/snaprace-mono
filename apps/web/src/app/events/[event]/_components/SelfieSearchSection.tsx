"use client";

interface SelfieSearchSectionProps {
  eventId: string;
}

export function SelfieSearchSection({ eventId }: SelfieSearchSectionProps) {
  return (
    <section className="border-border/60 bg-background/95 rounded-2xl border p-4 shadow-sm md:p-6">
      <h3 className="text-base font-semibold md:text-lg">Selfie Search</h3>
      <p className="text-muted-foreground mt-2 text-sm">
        Placeholder selfie search controls for event <strong>{eventId}</strong>.
      </p>
    </section>
  );
}
