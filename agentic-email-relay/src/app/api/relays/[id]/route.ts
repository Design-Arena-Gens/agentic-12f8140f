import { NextResponse } from "next/server";
import { relayStore } from "@/lib/store";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_: Request, context: RouteContext) {
  const { id } = await context.params;
  const relay = relayStore.getRelay(id);
  if (!relay) {
    return NextResponse.json({ error: "Relay not found" }, { status: 404 });
  }
  return NextResponse.json({ relay });
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const updates = await request.json();
  const relay = relayStore.updateRelay(id, updates);
  if (!relay) {
    return NextResponse.json({ error: "Relay not found" }, { status: 404 });
  }
  return NextResponse.json({ relay });
}

export async function DELETE(_: Request, context: RouteContext) {
  const { id } = await context.params;
  const deleted = relayStore.deleteRelay(id);
  if (!deleted) {
    return NextResponse.json({ error: "Relay not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
