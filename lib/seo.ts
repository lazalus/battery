const DEFAULT_SITE_URL = "https://batteryfit.org";

export function getSiteUrl() {
  const configured =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.SITE_URL?.trim() ||
    DEFAULT_SITE_URL;

  try {
    const url = new URL(configured);
    return `${url.protocol}//${url.host}`;
  } catch {
    return DEFAULT_SITE_URL;
  }
}

export function toAbsoluteUrl(path: string) {
  const siteUrl = getSiteUrl();
  if (!path || path === "/") {
    return siteUrl;
  }

  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  return `${siteUrl}${path.startsWith("/") ? "" : "/"}${path}`;
}
