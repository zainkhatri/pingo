export function getApiUrl(path: string): string {
  // In development, use the full URL from environment variable
  const baseUrl = import.meta.env.VITE_API_URL;
  if (baseUrl) {
    return `${baseUrl}${path}`;
  }
  
  // In production, use relative URLs
  return path;
}
