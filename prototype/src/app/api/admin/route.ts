import { adminSnapshot } from "@/lib/agent";

export const runtime = "nodejs";

export async function GET() {
  return Response.json(adminSnapshot());
}
