"use client";

export function PhotoGallery() {
  return (
    <section className="mt-8 border-t pt-6">
      <div className="text-muted-foreground text-sm">
        PhotoGallerySection (placeholder) – gallery grid goes here.
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="bg-muted/40 border-border/60 aspect-4/3 rounded-xl border"
          />
        ))}
      </div>
    </section>
  );
}
