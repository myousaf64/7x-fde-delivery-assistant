import { NextRequest, NextResponse } from "next/server";

/**
 * Demo access gate.
 *
 * The dataset in this demo is confidential, so a hosted deployment must not be
 * open. Set DEMO_PASSCODE in the hosting environment to require HTTP basic auth
 * on every page and API route. With no DEMO_PASSCODE set (local development),
 * the gate is off and nothing changes.
 *
 * Username: blank. Password: the value of DEMO_PASSCODE.
 */
export const config = {
  // Brand artwork and static assets stay open. They carry no customer data, and
  // keeping them open means the header renders even for a request that has no
  // credentials yet. Every page and API route stays gated.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|emx-latin.jpg|emx-arabic.jpg).*)"],
};

async function digest(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function middleware(req: NextRequest) {
  const expected = process.env.DEMO_PASSCODE;
  if (!expected) return NextResponse.next();

  const header = req.headers.get("authorization") ?? "";
  const [scheme, encoded] = header.split(" ");
  if (scheme === "Basic" && encoded) {
    const given = atob(encoded).split(":").slice(1).join(":");
    // Compare digests so the check does not short-circuit on the first wrong byte.
    if ((await digest(given)) === (await digest(expected))) return NextResponse.next();
  }
  return new NextResponse("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Delivery assistant demo", charset="UTF-8"' },
  });
}
