/**
 * Workaround per bug Next.js 16 + Turbopack (dev only):
 * `Failed to execute 'measure' on 'Performance': '…' cannot have a negative time stamp.`
 * @see https://github.com/vercel/next.js/issues/86060
 */
if (process.env.NODE_ENV === "development") {
  const original = performance.measure.bind(performance);
  performance.measure = ((...args: Parameters<typeof performance.measure>) => {
    try {
      return original(...args);
    } catch (e) {
      if (
        e instanceof Error &&
        /negative time stamp/i.test(e.message)
      ) {
        return undefined as unknown as PerformanceMeasure;
      }
      throw e;
    }
  }) as typeof performance.measure;
}
