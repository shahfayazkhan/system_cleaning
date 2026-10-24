/** true when built for a cloud host (Vercel). Inlined at build time, safe for client & edge. */
export const IS_HOSTED = process.env.NEXT_PUBLIC_HOSTED === "1";
