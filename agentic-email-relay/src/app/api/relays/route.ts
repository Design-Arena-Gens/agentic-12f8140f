import { NextResponse } from "next/server";
import { relayStore } from "@/lib/store";
import { Relay } from "@/lib/types";

export async function GET() {
  const relays = relayStore.listRelays();
  return NextResponse.json({ relays });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<Relay>;

    if (!body?.name || !body?.inboundAddress || !body?.targetInbox) {
      return NextResponse.json(
        { error: "name, inboundAddress, and targetInbox are required" },
        { status: 400 },
      );
    }

    const relay = relayStore.createRelay({
      name: body.name,
      description: body.description ?? "",
      inboundAddress: body.inboundAddress,
      targetInbox: body.targetInbox,
      actions: {
        forwardTo: body.actions?.forwardTo ?? [body.targetInbox],
        cc: body.actions?.cc ?? [],
        autoResponse: body.actions?.autoResponse ?? {
          enabled: false,
          subject: "",
          body: "",
        },
        webhookUrl: body.actions?.webhookUrl,
      },
      conditions: {
        subjectKeywords: body.conditions?.subjectKeywords ?? [],
        allowedSenders: body.conditions?.allowedSenders ?? [],
        matchAllKeywords: body.conditions?.matchAllKeywords ?? false,
      },
      active: body.active ?? true,
    });

    return NextResponse.json({ relay });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
