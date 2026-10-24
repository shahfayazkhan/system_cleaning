import { NextResponse, type NextRequest } from "next/server";

/**
 * This app can delete files, so its API must only ever be reachable from THIS computer.
 *  - Host header must be localhost / 127.0.0.1 / ::1  (blocks LAN access & DNS-rebinding)
 *  - State-changing requests must come from the same origin (blocks CSRF from other websites)
 */
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

function hostname(hostHeader: string | null): string {
  if (!hostHeader) return "";
  if (hostHeader.startsWith("[")) return hostHeader.slice(0, hostHeader.indexOf("]") + 1);
  return hostHeader.split(":")[0];
}

export function middleware(req: NextRequest) {
  const host = hostname(req.headers.get("host"));
  if (!LOCAL_HOSTS.has(host)) {
    return new NextResponse("Clean Cache only accepts connections from this computer.", { status: 403 });
  }

  if (req.nextUrl.pathname.startsWith("/api/") && req.method !== "GET" && req.method !== "HEAD") {
    const origin = req.headers.get("origin");
    const site = req.headers.get("sec-fetch-site");
    const originOk = origin ? LOCAL_HOSTS.has(hostname(new URL(origin).host)) : site === "same-origin";
    if (!originOk || req.headers.get("x-clean-cache") !== "1") {
      return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
    }
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
