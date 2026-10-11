declare module "robots-parser" {
  export default function robotsParser(
    url: string,
    contents: string
  ): {
    isAllowed(url: string, userAgent?: string): boolean | undefined;
    isDisallowed(url: string, userAgent?: string): boolean | undefined;
    getMatchingLineNumber(url: string, userAgent?: string): number | undefined;
    getCrawlDelay(userAgent?: string): number | undefined;
    getSitemaps(): string[];
    getPreferredHost(): string | null;
  };
}
