import { NextResponse } from "next/server";
import { relayStore } from "@/lib/store";
import { RelayEvaluationRequest } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RelayEvaluationRequest;

    if (!body.subject || !body.from || !body.to) {
      return NextResponse.json(
        { error: "subject, from, and to fields are required" },
        { status: 400 },
      );
    }

    const evaluation = relayStore.evaluateEmail(body);
    return NextResponse.json({ evaluation });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
