import { NextResponse, type NextRequest } from "next/server";
import { IS_HOSTED } from "@/lib/mode";
import { isPairedOrigin, verifyPairing } from "@/lib/server/pairing";

/**
 * This app can delete files, so its API is locked down:
 *  - Host header must be localhost / 127.0.0.1 / ::1        (blocks LAN access & DNS-rebinding)
 *  - Same-origin requests (the local UI) need the x-clean-cache header (blocks CSRF)
 *  - Cross-origin requests are allowed ONLY from dashboards you approved on the local
 *    /pair page, and only with that dashboard's secret token (see lib/server/pairing.ts)
 *  - Pairing management (/api/pair, /api/pairings) is local-only, so a website can never
 *    grant itself access.
 */
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
const LOCAL_ONLY_API = ["/api/pair", "/api/pairings"];

function hostname(hostHeader: string | null): string {
  if (!hostHeader) return "";
  if (hostHeader.startsWith("[")) return hostHeader.slice(0, hostHeader.indexOf("]") + 1);
  return hostHeader.split(":")[0];
}

function isLocalOrigin(origin: string | null) {
  if (!origin) return false;
  try {
    return LOCAL_HOSTS.has(hostname(new URL(origin).host));
  } catch {
    return false;
  }
}

function corsHeaders(origin: string, req: NextRequest): Record<string, string> {
  const h: Record<string, string> = {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-clean-cache, x-clean-cache-token",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
  // Chrome Private/Local Network Access preflight
  if (req.headers.get("access-control-request-private-network") === "true") h["Access-Control-Allow-Private-Network"] = "true";
  return h;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Hosted (Vercel): the page is a dashboard that talks to YOUR local agent from the browser.
  // The hosted server's own file-system API is never exposed on the internet.
  if (IS_HOSTED) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "The hosted dashboard talks to the CleanCache agent on your computer." }, { status: 403 });
    }
    return NextResponse.next();
  }

  const host = hostname(req.headers.get("host"));
  if (!LOCAL_HOSTS.has(host)) {
    return new NextResponse("Clean Cache only accepts connections from this computer.", { status: 403 });
  }
  if (!pathname.startsWith("/api/")) return NextResponse.next();

  const origin = req.headers.get("origin");
  const selfOrigin = `http://${req.headers.get("host")}`;
  // anything that isn't this exact agent page (even another localhost port) is cross-origin
  const crossOrigin = !!origin && origin !== selfOrigin && origin !== selfOrigin.replace("http://", "https://");

  // Public health check — lets a hosted dashboard detect that the agent is running. No data.
  if (pathname === "/api/ping") {
    const res = req.method === "OPTIONS" ? new NextResponse(null, { status: 204 }) : NextResponse.next();
    if (origin) {
      const h = corsHeaders(origin, req);
      Object.entries(h).forEach(([k, v]) => res.headers.set(k, v));
    }
    return res;
  }

  if (crossOrigin) {
    if (LOCAL_ONLY_API.includes(pathname)) return NextResponse.json({ error: "Only available on this computer" }, { status: 403 });
    const paired = isPairedOrigin(origin!);
    if (req.method === "OPTIONS") {
      if (!paired) return new NextResponse(null, { status: 403 });
      return new NextResponse(null, { status: 204, headers: corsHeaders(origin!, req) });
    }
    if (!paired || !verifyPairing(origin!, req.headers.get("x-clean-cache-token"))) {
      // CORS headers on the error so the dashboard can show "permission required"
      return NextResponse.json({ error: "not-paired" }, { status: 401, headers: paired ? corsHeaders(origin!, req) : { "Access-Control-Allow-Origin": origin!, Vary: "Origin" } });
    }
    const res = NextResponse.next();
    Object.entries(corsHeaders(origin!, req)).forEach(([k, v]) => res.headers.set(k, v));
    return res;
  }

  // Same-origin (local UI): writes need the custom header
  if (req.method !== "GET" && req.method !== "HEAD") {
    const site = req.headers.get("sec-fetch-site");
    const originOk = origin ? isLocalOrigin(origin) : site === "same-origin" || site === null;
    if (!originOk || req.headers.get("x-clean-cache") !== "1") {
      return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
  runtime: "nodejs",
};
