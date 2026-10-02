import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const CANONICAL_HOST = "birding.live";

export function proxy(request: NextRequest) {
  const hostHeader = request.headers.get("host") ?? request.headers.get("x-forwarded-host") ?? "";
  const hostname = hostHeader.split(":")[0].toLowerCase();
  if (hostname !== `www.${CANONICAL_HOST}`) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.protocol = "https:";
  url.hostname = CANONICAL_HOST;
  url.port = "";
  return NextResponse.redirect(url, 308);
}

export const config = {
  matcher: "/:path*",
};
