interface AssetPaths {
  logo: string;
  getPartnerImage: (partnerName: string) => string;
  fallbackLogo: string;
  favicon?: string;
}

export function getOrganizationAssets(subdomain?: string | null): AssetPaths {
  const isMainSite = !subdomain;

  return {
    logo: isMainSite
      ? "/images/logo.png"
      : `/images/organizations/${subdomain}/logo.png`,

    getPartnerImage: (partnerName: string) => {
      // const normalizedName = partnerName.toLowerCase().replace(/\s+/g, "-");
      return isMainSite
        ? `/images/partners/partner-${partnerName}.png`
        : `/images/organizations/${subdomain}/partners/partner-${partnerName}.png`;
    },

    fallbackLogo: "/images/default-logo.png",

    favicon: isMainSite
      ? "/favicon.ico"
      : `/images/organizations/${subdomain}/favicon.ico`,
  };
}

export function getImagePathForOrganization(
  subdomain: string | null | undefined,
  imagePath: string,
): string {
  if (!subdomain) {
    return imagePath;
  }
  return `/images/organizations/${subdomain}/${imagePath}`;
}
