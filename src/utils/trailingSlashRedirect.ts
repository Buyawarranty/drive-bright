// Utility to ensure trailing slashes for SEO consistency
export const addTrailingSlash = (path: string): string => {
  if (path === '/' || path.endsWith('/')) {
    return path;
  }
  return `${path}/`;
};

export const normalizeUrl = (url: string): string => {
  const urlObj = new URL(url);
  if (urlObj.pathname !== '/' && !urlObj.pathname.endsWith('/')) {
    urlObj.pathname = `${urlObj.pathname}/`;
  }
  return urlObj.toString();
};
