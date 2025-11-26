import { oklch } from "culori";
import type { Organizer } from "@/server/services/organizers";
import { getPrimaryColor, getSecondaryColor } from "@/lib/organizer-helpers";

interface OrganizerStylesProps {
  organizer: Organizer | null;
}

export function OrganizerStyles({ organizer }: OrganizerStylesProps) {
  if (!organizer) return null;

  const primaryColor = getPrimaryColor(organizer);
  const secondaryColor = getSecondaryColor(organizer);
  let styleContent = "";

  if (primaryColor) {
    // Convert hex to oklch using culori
    const primaryOklchColor = oklch(primaryColor);
    if (primaryOklchColor) {
      const l = primaryOklchColor.l ?? 0;
      const c = primaryOklchColor.c ?? 0;
      const h = primaryOklchColor.h ?? 0;
      const primaryOklchString = `oklch(${l.toFixed(4)} ${c.toFixed(4)} ${h.toFixed(2)})`;
      const foregroundColor = l > 0.6 ? "oklch(0.1 0 0)" : "oklch(0.98 0 0)";

      styleContent += `
        --primary: ${primaryOklchString};
        --primary-foreground: ${foregroundColor};
        --organizer-primary: ${primaryColor};
      `;
    }
  }

  if (secondaryColor) {
    const secondaryOklchColor = oklch(secondaryColor);
    if (secondaryOklchColor) {
      const l = secondaryOklchColor.l ?? 0;
      const c = secondaryOklchColor.c ?? 0;
      const h = secondaryOklchColor.h ?? 0;
      const secondaryOklchString = `oklch(${l.toFixed(4)} ${c.toFixed(4)} ${h.toFixed(2)})`;
      const secondaryForeground =
        l > 0.6 ? "oklch(0.1 0 0)" : "oklch(0.98 0 0)";

      styleContent += `
        --secondary: ${secondaryOklchString};
        --secondary-foreground: ${secondaryForeground};
        --organizer-secondary: ${secondaryColor};
      `;
    }
  }

  if (!styleContent) return null;

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `:root { ${styleContent} }`,
      }}
    />
  );
}

