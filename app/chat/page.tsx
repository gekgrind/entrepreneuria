"use client";

import { type FormEvent, type ChangeEvent, useState } from "react";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    setFile(selected);
  }

  async function uploadFile(): Promise<string | null> {
    if (!file) return null;

    setUploading(true);

    const form = new FormData();
    form.append("file", file);

    try {
      const res = await fetch("/api/upload-file", {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        throw new Error("File upload failed.");
      }

      const data = (await res.json()) as { url?: string };
      return data.url ?? null;
    } catch (err) {
      console.error(err);
      return null;
    } finally {
      setUploading(false);
      setFile(null);
    }
  }

  async function sendMessage(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!input.trim() && !file) return;

    setLoading(true);

    let content = input.trim();

    const fileUrl = await uploadFile();

    if (fileUrl) {
      content = `${content}\n\nAttached File:\n${fileUrl}`;
    }

    const userMessage: ChatMessage = {
      role: "user",
      content,
    };

    const nextMessages = [...messages, userMessage];

    setMessages(nextMessages);
    setInput("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: nextMessages,
        }),
      });

      if (!res.ok) {
        throw new Error("Chat request failed.");
      }

      const text = await res.text();

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: text,
        },
      ]);
    } catch (err) {
      console.error(err);

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Error contacting server.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative -mt-[calc(var(--header-height)+20px)] min-h-screen overflow-x-clip bg-[#081527] text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 h-[560px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(79,124,167,0.28),transparent_65%)]"
      />

      <div className="relative mx-auto max-w-3xl px-6 pb-24 pt-[calc(var(--header-height)+88px)] sm:px-10">
        <p className="mb-5 text-[11px] uppercase tracking-[0.28em] text-white/45 [font-family:var(--font-label)] sm:text-xs">
          Prospra — AI founder mentor
        </p>
        <h1 className="text-balance text-4xl font-medium leading-[1.08] tracking-tight text-white sm:text-5xl">
          Ask <em className="italic">Prospra</em> anything.
        </h1>

        <div className="mt-10 mb-6 h-[400px] overflow-y-auto rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          {messages.length === 0 && (
            <p className="text-center leading-7 text-white/45">
              Ask a question or attach a file to begin.
            </p>
          )}

          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={
                "mb-3 max-w-[80%] rounded-2xl px-4 py-3 " +
                (message.role === "user"
                  ? "ml-auto border border-[rgba(0,212,255,0.25)] bg-[rgba(0,212,255,0.1)]"
                  : "border border-white/10 bg-white/[0.05]")
              }
            >
              <p className="whitespace-pre-wrap text-sm leading-6 text-white/85">
                {message.content}
              </p>
            </div>
          ))}

          {loading && (
            <div className="max-w-[60%] rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white/60">
              Thinking…
            </div>
          )}
        </div>

        <div className="mb-3">
          <label className="inline-block cursor-pointer rounded-full border border-white/15 bg-white/[0.04] px-4 py-2 text-sm font-medium text-white/70 transition hover:border-white/40 hover:text-white">
            Attach file
            <input type="file" className="hidden" onChange={handleFileChange} />
          </label>

          {file ? (
            <span className="ml-3 text-sm text-white/60">{file.name}</span>
          ) : null}

          {uploading ? (
            <span className="ml-3 text-sm text-white/45">Uploading...</span>
          ) : null}
        </div>

        <form onSubmit={sendMessage} className="flex gap-3">
          <input
            className="h-13 min-w-0 flex-1 rounded-full !border-white/15 !bg-white/[0.06] px-5 text-sm !text-white outline-none transition placeholder:!text-white/40 focus:!border-white/40"
            placeholder="Ask Prospra anything…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />

          <button
            type="submit"
            className="group relative h-13 shrink-0 overflow-hidden rounded-full bg-[var(--brand-orange)] px-6 text-sm font-semibold text-white transition hover:bg-[#b96a24] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={loading || uploading}
          >
            Send
            <span className="button-shimmer" aria-hidden="true" />
          </button>
        </form>
      </div>
    </div>
  );
}
