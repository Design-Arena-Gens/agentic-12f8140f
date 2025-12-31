"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  Relay,
  RelayEvaluationRequest,
  RelayEvaluationResult,
  RelayLog,
} from "@/lib/types";

type RelayFormState = {
  name: string;
  description: string;
  inboundAddress: string;
  targetInbox: string;
  forwardTo: string;
  cc: string;
  subjectKeywords: string;
  allowedSenders: string;
  matchAllKeywords: boolean;
  autoResponseEnabled: boolean;
  autoResponseSubject: string;
  autoResponseBody: string;
  webhookUrl: string;
};

const defaultFormState: RelayFormState = {
  name: "",
  description: "",
  inboundAddress: "",
  targetInbox: "",
  forwardTo: "",
  cc: "",
  subjectKeywords: "",
  allowedSenders: "",
  matchAllKeywords: false,
  autoResponseEnabled: false,
  autoResponseSubject: "",
  autoResponseBody: "",
  webhookUrl: "",
};

const headers = {
  "Content-Type": "application/json",
};

const dedupe = (value: string) =>
  Array.from(
    new Set(
      value
        .split(/[,;\n]/)
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  );

export function Dashboard() {
  const [relays, setRelays] = useState<Relay[]>([]);
  const [logs, setLogs] = useState<RelayLog[]>([]);
  const [form, setForm] = useState<RelayFormState>(defaultFormState);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [simRequest, setSimRequest] = useState<RelayEvaluationRequest>({
    subject: "",
    from: "",
    to: "",
    cc: [],
    bodyPreview: "",
  });
  const [evaluation, setEvaluation] = useState<RelayEvaluationResult[] | null>(null);
  const [simError, setSimError] = useState<string | null>(null);
  const [simLoading, setSimLoading] = useState(false);

  const loadRelays = useCallback(async () => {
    const response = await fetch("/api/relays", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Unable to fetch relays");
    }
    const payload = (await response.json()) as { relays: Relay[] };
    setRelays(payload.relays);
  }, []);

  const loadLogs = useCallback(async () => {
    const response = await fetch("/api/logs", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Unable to fetch logs");
    }
    const payload = (await response.json()) as { logs: RelayLog[] };
    setLogs(payload.logs);
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        setLoading(true);
        await Promise.all([loadRelays(), loadLogs()]);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };
    void bootstrap();
  }, [loadRelays, loadLogs]);

  const resetForm = () => {
    setForm(defaultFormState);
  };

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setCreating(true);

    try {
      const response = await fetch("/api/relays", {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          inboundAddress: form.inboundAddress,
          targetInbox: form.targetInbox,
          actions: {
            forwardTo: dedupe(form.forwardTo),
            cc: dedupe(form.cc),
            autoResponse: {
              enabled: form.autoResponseEnabled,
              subject: form.autoResponseSubject,
              body: form.autoResponseBody,
            },
            webhookUrl: form.webhookUrl || undefined,
          },
          conditions: {
            subjectKeywords: dedupe(form.subjectKeywords),
            allowedSenders: dedupe(form.allowedSenders),
            matchAllKeywords: form.matchAllKeywords,
          },
          active: true,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Unable to create relay");
      }

      resetForm();
      await loadRelays();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const toggleRelay = async (relay: Relay) => {
    try {
      const response = await fetch(`/api/relays/${relay.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ active: !relay.active }),
      });
      if (!response.ok) {
        throw new Error("Unable to toggle relay");
      }
      await loadRelays();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const deleteRelay = async (relay: Relay) => {
    try {
      const response = await fetch(`/api/relays/${relay.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Unable to delete relay");
      }
      await Promise.all([loadRelays(), loadLogs()]);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleSimulate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSimError(null);
    setSimLoading(true);
    setEvaluation(null);
    try {
      const response = await fetch("/api/simulate", {
        method: "POST",
        headers,
        body: JSON.stringify({
          ...simRequest,
          cc: simRequest.cc ?? [],
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Simulation failed");
      }

      const payload = (await response.json()) as {
        evaluation: RelayEvaluationResult[];
      };
      setEvaluation(payload.evaluation);
      await loadLogs();
    } catch (err) {
      setSimError((err as Error).message);
    } finally {
      setSimLoading(false);
    }
  };

  const activeCount = useMemo(() => relays.filter((relay) => relay.active).length, [relays]);

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-50">
      <header className="border-b border-white/10 bg-slate-950">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-slate-400">RelayHQ</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-white">
              Agentic Email Relay Orchestrator
            </h1>
            <p className="mt-2 max-w-xl text-sm text-slate-400">
              Design decisioning agents that triage inbound mail, forward messages intelligently,
              and keep your team in sync.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-4 text-center">
            <p className="text-xs uppercase tracking-wide text-slate-300">Active relays</p>
            <p className="text-4xl font-semibold text-emerald-400">{activeCount}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-6 py-10 pb-20">
        {error ? (
          <div className="rounded-xl border border-red-500/40 bg-red-950/40 p-4 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <section className="grid grid-cols-1 gap-8 xl:grid-cols-[1.35fr_1fr]">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-white">Relay Catalogue</h2>
                <p className="text-sm text-slate-400">
                  Every active relay exposes an AI powered routing policy that can be updated at any
                  time.
                </p>
              </div>
              <button
                className="rounded-full border border-emerald-400/40 px-4 py-2 text-sm font-medium text-emerald-300 transition hover:border-emerald-400 hover:text-emerald-200"
                onClick={async () => {
                  await Promise.all([loadRelays(), loadLogs()]);
                }}
              >
                Refresh
              </button>
            </div>

            <div className="mt-6 space-y-4">
              {loading ? (
                <div className="animate-pulse space-y-3">
                  <div className="h-20 rounded-2xl bg-white/10" />
                  <div className="h-20 rounded-2xl bg-white/10" />
                  <div className="h-20 rounded-2xl bg-white/10" />
                </div>
              ) : relays.length ? (
                relays.map((relay) => (
                  <article
                    key={relay.id}
                    className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-[0_30px_80px_-25px_rgba(15,118,110,0.35)]"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-semibold text-white">{relay.name}</h3>
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-medium ${relay.active ? "bg-emerald-500/20 text-emerald-200" : "bg-slate-700 text-slate-200"}`}
                          >
                            {relay.active ? "Active" : "Paused"}
                          </span>
                        </div>
                        {relay.description ? (
                          <p className="mt-2 text-sm text-slate-400">{relay.description}</p>
                        ) : null}
                        <dl className="mt-4 grid gap-3 text-sm text-slate-300 md:grid-cols-2">
                          <div>
                            <dt className="text-xs uppercase tracking-wide text-slate-400">
                              Inbound Alias
                            </dt>
                            <dd className="text-sm font-medium text-white">{relay.inboundAddress}</dd>
                          </div>
                          <div>
                            <dt className="text-xs uppercase tracking-wide text-slate-400">
                              Target Inbox
                            </dt>
                            <dd className="text-sm font-medium text-white">{relay.targetInbox}</dd>
                          </div>
                          <div>
                            <dt className="text-xs uppercase tracking-wide text-slate-400">
                              Subject Keywords
                            </dt>
                            <dd>{relay.conditions.subjectKeywords.join(", ") || "Any"}</dd>
                          </div>
                          <div>
                            <dt className="text-xs uppercase tracking-wide text-slate-400">
                              Allowed Senders
                            </dt>
                            <dd>{relay.conditions.allowedSenders.join(", ") || "Any"}</dd>
                          </div>
                          {relay.actions.webhookUrl ? (
                            <div className="md:col-span-2">
                              <dt className="text-xs uppercase tracking-wide text-slate-400">
                                Webhook
                              </dt>
                              <dd className="truncate">{relay.actions.webhookUrl}</dd>
                            </div>
                          ) : null}
                          {relay.actions.autoResponse?.enabled ? (
                            <div className="md:col-span-2">
                              <dt className="text-xs uppercase tracking-wide text-slate-400">
                                Auto Response
                              </dt>
                              <dd className="text-slate-200">
                                {relay.actions.autoResponse.subject || "Custom reply"}
                              </dd>
                            </div>
                          ) : null}
                        </dl>
                      </div>
                      <div className="flex gap-2">
                        <button
                          className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-200 transition hover:border-white/40"
                          onClick={() => toggleRelay(relay)}
                        >
                          {relay.active ? "Pause" : "Activate"}
                        </button>
                        <button
                          className="rounded-full border border-red-500/30 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-red-300 transition hover:border-red-500/60 hover:text-red-200"
                          onClick={() => deleteRelay(relay)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <p className="rounded-xl border border-white/10 bg-slate-900/70 p-6 text-sm text-slate-300">
                  No relays yet — use the composer to draft your first routing policy.
                </p>
              )}
            </div>
          </div>

          <div className="space-y-8">
            <form
              className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-[0_30px_120px_-35px_rgba(15,118,110,0.5)]"
              onSubmit={handleCreate}
            >
              <h2 className="text-xl font-semibold text-white">Compose Relay</h2>
              <p className="mt-1 text-sm text-slate-400">
                Define the targeting rules, downstream inboxes, and notifications this relay powers.
              </p>
              <div className="mt-6 space-y-4">
                <div>
                  <label className="text-xs uppercase tracking-wide text-slate-400">Name</label>
                  <input
                    required
                    className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900/70 px-4 py-2 text-sm text-white outline-none focus:border-emerald-400/60 focus:ring-emerald-400/40"
                    value={form.name}
                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wide text-slate-400">
                    Summary
                  </label>
                  <textarea
                    className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900/70 px-4 py-2 text-sm text-white outline-none focus:border-emerald-400/60 focus:ring-emerald-400/40"
                    rows={2}
                    value={form.description}
                    onChange={(event) => setForm({ ...form, description: event.target.value })}
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-xs uppercase tracking-wide text-slate-400">
                      Inbound Alias
                    </label>
                    <input
                      required
                      placeholder="alerts@relayhq.dev"
                      className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900/70 px-4 py-2 text-sm text-white outline-none focus:border-emerald-400/60 focus:ring-emerald-400/40"
                      value={form.inboundAddress}
                      onChange={(event) =>
                        setForm({ ...form, inboundAddress: event.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-wide text-slate-400">
                      Primary Inbox
                    </label>
                    <input
                      required
                      placeholder="success@relayhq.dev"
                      className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900/70 px-4 py-2 text-sm text-white outline-none focus:border-emerald-400/60 focus:ring-emerald-400/40"
                      value={form.targetInbox}
                      onChange={(event) =>
                        setForm({ ...form, targetInbox: event.target.value })
                      }
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wide text-slate-400">
                    Forwarding Targets
                  </label>
                  <input
                    placeholder="Comma separated emails"
                    className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900/70 px-4 py-2 text-sm text-white outline-none focus:border-emerald-400/60 focus:ring-emerald-400/40"
                    value={form.forwardTo}
                    onChange={(event) => setForm({ ...form, forwardTo: event.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wide text-slate-400">
                    CC Notifications
                  </label>
                  <input
                    placeholder="Comma separated emails"
                    className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900/70 px-4 py-2 text-sm text-white outline-none focus:border-emerald-400/60 focus:ring-emerald-400/40"
                    value={form.cc}
                    onChange={(event) => setForm({ ...form, cc: event.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wide text-slate-400">
                    Subject Keywords
                  </label>
                  <input
                    placeholder="urgent, downtime"
                    className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900/70 px-4 py-2 text-sm text-white outline-none focus:border-emerald-400/60 focus:ring-emerald-400/40"
                    value={form.subjectKeywords}
                    onChange={(event) =>
                      setForm({ ...form, subjectKeywords: event.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wide text-slate-400">
                    Allowed Senders (email or @domain)
                  </label>
                  <input
                    placeholder="@enterprise.com"
                    className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900/70 px-4 py-2 text-sm text-white outline-none focus:border-emerald-400/60 focus:ring-emerald-400/40"
                    value={form.allowedSenders}
                    onChange={(event) =>
                      setForm({ ...form, allowedSenders: event.target.value })
                    }
                  />
                </div>
                <label className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-300">
                  <input
                    type="checkbox"
                    checked={form.matchAllKeywords}
                    onChange={(event) =>
                      setForm({ ...form, matchAllKeywords: event.target.checked })
                    }
                    className="h-4 w-4 rounded border border-white/20 bg-slate-900 text-emerald-400 focus:ring-emerald-300"
                  />
                  Require all keywords to match
                </label>
                <label className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-300">
                  <input
                    type="checkbox"
                    checked={form.autoResponseEnabled}
                    onChange={(event) =>
                      setForm({ ...form, autoResponseEnabled: event.target.checked })
                    }
                    className="h-4 w-4 rounded border border-white/20 bg-slate-900 text-emerald-400 focus:ring-emerald-300"
                  />
                  Auto response enabled
                </label>
                {form.autoResponseEnabled ? (
                  <>
                    <div>
                      <label className="text-xs uppercase tracking-wide text-slate-400">
                        Auto Response Subject
                      </label>
                      <input
                        className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900/70 px-4 py-2 text-sm text-white outline-none focus:border-emerald-400/60 focus:ring-emerald-400/40"
                        value={form.autoResponseSubject}
                        onChange={(event) =>
                          setForm({ ...form, autoResponseSubject: event.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-wide text-slate-400">
                        Auto Response Body
                      </label>
                      <textarea
                        rows={3}
                        className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900/70 px-4 py-2 text-sm text-white outline-none focus:border-emerald-400/60 focus:ring-emerald-400/40"
                        value={form.autoResponseBody}
                        onChange={(event) =>
                          setForm({ ...form, autoResponseBody: event.target.value })
                        }
                      />
                    </div>
                  </>
                ) : null}
                <div>
                  <label className="text-xs uppercase tracking-wide text-slate-400">
                    Webhook URL (optional)
                  </label>
                  <input
                    placeholder="https://hooks.slack.com/services/..."
                    className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900/70 px-4 py-2 text-sm text-white outline-none focus:border-emerald-400/60 focus:ring-emerald-400/40"
                    value={form.webhookUrl}
                    onChange={(event) => setForm({ ...form, webhookUrl: event.target.value })}
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={creating}
                className="mt-6 w-full rounded-full bg-emerald-500 py-3 text-sm font-semibold uppercase tracking-wide text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-600"
              >
                {creating ? "Creating..." : "Launch Relay"}
              </button>
            </form>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
              <h2 className="text-xl font-semibold text-white">Deliverability Feed</h2>
              <p className="mt-1 text-sm text-slate-400">
                Inspect the latest routing decisions from the relay layer.
              </p>
              <div className="mt-4 space-y-3">
                {logs.length ? (
                  logs.map((log) => (
                    <div
                      key={log.id}
                      className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-sm text-slate-200"
                    >
                      <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-slate-400">
                        <span>{new Date(log.timestamp).toLocaleString()}</span>
                        <span>•</span>
                        <span>{log.relayName}</span>
                        <span>•</span>
                        <span className={log.status === "relayed" ? "text-emerald-300" : "text-slate-300"}>
                          {log.status}
                        </span>
                      </div>
                      <p className="mt-2 text-base font-medium text-white">{log.subject}</p>
                      <p className="text-xs text-slate-400">from {log.from}</p>
                      <p className="mt-2 text-xs text-slate-300">{log.actionSummary}</p>
                    </div>
                  ))
                ) : (
                  <p className="rounded-xl border border-white/10 bg-slate-900/70 p-4 text-sm text-slate-300">
                    No relay events yet. Simulate an inbound email to see live routing decisions.
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/80 via-slate-900/60 to-slate-950/80 p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">Simulate Inbound Email</h2>
              <p className="text-sm text-slate-400">
                Drop the message metadata and the agent will preview how each relay responds.
              </p>
            </div>
            <button
              className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-200 transition hover:border-white/40"
              onClick={() => {
                setSimRequest({
                  subject: "",
                  from: "",
                  to: "",
                  cc: [],
                  bodyPreview: "",
                });
                setEvaluation(null);
              }}
            >
              Reset
            </button>
          </div>

          <form className="mt-6 grid gap-4 md:grid-cols-2" onSubmit={handleSimulate}>
            <div className="md:col-span-1">
              <label className="text-xs uppercase tracking-wide text-slate-400">Subject</label>
              <input
                required
                className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900/70 px-4 py-2 text-sm text-white outline-none focus:border-emerald-400/60 focus:ring-emerald-400/40"
                value={simRequest.subject}
                onChange={(event) =>
                  setSimRequest((prev) => ({ ...prev, subject: event.target.value }))
                }
              />
            </div>
            <div className="md:col-span-1">
              <label className="text-xs uppercase tracking-wide text-slate-400">From</label>
              <input
                required
                placeholder="ceo@enterprise.com"
                className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900/70 px-4 py-2 text-sm text-white outline-none focus:border-emerald-400/60 focus:ring-emerald-400/40"
                value={simRequest.from}
                onChange={(event) =>
                  setSimRequest((prev) => ({ ...prev, from: event.target.value }))
                }
              />
            </div>
            <div className="md:col-span-1">
              <label className="text-xs uppercase tracking-wide text-slate-400">To</label>
              <input
                required
                placeholder="support@relayhq.dev"
                className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900/70 px-4 py-2 text-sm text-white outline-none focus:border-emerald-400/60 focus:ring-emerald-400/40"
                value={simRequest.to}
                onChange={(event) =>
                  setSimRequest((prev) => ({ ...prev, to: event.target.value }))
                }
              />
            </div>
            <div className="md:col-span-1">
              <label className="text-xs uppercase tracking-wide text-slate-400">CC</label>
              <input
                placeholder="Comma separated"
                className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900/70 px-4 py-2 text-sm text-white outline-none focus:border-emerald-400/60 focus:ring-emerald-400/40"
                value={(simRequest.cc ?? []).join(", ")}
                onChange={(event) =>
                  setSimRequest((prev) => ({
                    ...prev,
                    cc: dedupe(event.target.value),
                  }))
                }
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs uppercase tracking-wide text-slate-400">
                Body Preview
              </label>
              <textarea
                rows={3}
                placeholder="Optional snippet that the agent can use for context."
                className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900/70 px-4 py-2 text-sm text-white outline-none focus:border-emerald-400/60 focus:ring-emerald-400/40"
                value={simRequest.bodyPreview ?? ""}
                onChange={(event) =>
                  setSimRequest((prev) => ({ ...prev, bodyPreview: event.target.value }))
                }
              />
            </div>
            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={simLoading}
                className="w-full rounded-full bg-emerald-500 py-3 text-sm font-semibold uppercase tracking-wide text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-600"
              >
                {simLoading ? "Running Simulation..." : "Evaluate Routing"}
              </button>
              {simError ? (
                <p className="mt-2 text-sm text-red-200">{simError}</p>
              ) : null}
            </div>
          </form>

          {evaluation ? (
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {evaluation.map((result) => (
                <div
                  key={result.relayId}
                  className="rounded-2xl border border-white/10 bg-slate-900/70 p-6 text-sm text-slate-200"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold text-white">{result.relayName}</h3>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${result.matched ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-700 text-slate-200"}`}
                    >
                      {result.matched ? "Will Relay" : "Will Skip"}
                    </span>
                  </div>
                  <div className="mt-3 space-y-2">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-400">Reasons</p>
                      <ul className="mt-1 space-y-1 text-xs text-slate-300">
                        {result.reasons.map((reason) => (
                          <li key={reason}>• {reason}</li>
                        ))}
                      </ul>
                    </div>
                    {result.actions.length ? (
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-400">Actions</p>
                        <ul className="mt-1 space-y-1 text-xs text-emerald-300">
                          {result.actions.map((action) => (
                            <li key={action}>• {action}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}
