import { oklch } from "culori";
import type { Organization } from "@/types/organization";
import { OrganizationHelper } from "@/lib/organization-helpers";

interface OrganizationStylesProps {
  organization: Organization | null;
}

export function OrganizationStyles({ organization }: OrganizationStylesProps) {
  if (!organization) return null;

  const org = new OrganizationHelper(organization);
  let styleContent = "";

  if (org.primaryColor) {
    // Convert hex to oklch using culori
    const primaryOklchColor = oklch(org.primaryColor);
    if (primaryOklchColor) {
      const l = primaryOklchColor.l ?? 0;
      const c = primaryOklchColor.c ?? 0;
      const h = primaryOklchColor.h ?? 0;
      const primaryOklchString = `oklch(${l.toFixed(4)} ${c.toFixed(4)} ${h.toFixed(2)})`;
      const foregroundColor = l > 0.6 ? "oklch(0.1 0 0)" : "oklch(0.98 0 0)";

      styleContent += `
        --primary: ${primaryOklchString};
        --primary-foreground: ${foregroundColor};
        --organization-primary: ${org.primaryColor};
      `;
    }
  }

  if (org.secondaryColor) {
    const secondaryOklchColor = oklch(org.secondaryColor);
    if (secondaryOklchColor) {
      const l = secondaryOklchColor.l ?? 0;
      const c = secondaryOklchColor.c ?? 0;
      const h = secondaryOklchColor.h ?? 0;
      const secondaryOklchString = `oklch(${l.toFixed(4)} ${c.toFixed(4)} ${h.toFixed(2)})`;
      const secondaryForeground = l > 0.6 ? "oklch(0.1 0 0)" : "oklch(0.98 0 0)";

      styleContent += `
        --secondary: ${secondaryOklchString};
        --secondary-foreground: ${secondaryForeground};
        --organization-secondary: ${org.secondaryColor};
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