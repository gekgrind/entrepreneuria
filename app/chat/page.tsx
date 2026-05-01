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
    <div className="mx-auto max-w-3xl p-6 text-white">
      <h1 className="mb-6 text-center text-3xl font-bold">
        Prospra AI Mentor 🤖
      </h1>

      <div className="mb-6 h-[400px] overflow-y-auto rounded-xl border border-brandBlue bg-brandNavy/60 p-4">
        {messages.length === 0 && (
          <p className="text-center text-brandBlueLight/60">
            Ask a question or attach a file to begin.
          </p>
        )}

        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={
              "mb-3 max-w-[80%] rounded-xl p-3 " +
              (message.role === "user"
                ? "ml-auto bg-brandBlueLight/20"
                : "border border-brandBlue bg-brandNavy/80")
            }
          >
            <p className="whitespace-pre-wrap text-sm">{message.content}</p>
          </div>
        ))}

        {loading && (
          <div className="max-w-[60%] rounded-xl border border-brandBlue bg-brandNavy/80 p-3">
            Thinking…
          </div>
        )}
      </div>

      <div className="mb-3">
        <label className="inline-block cursor-pointer rounded-xl border border-brandBlue bg-brandNavy px-3 py-2">
          📎 Attach File
          <input type="file" className="hidden" onChange={handleFileChange} />
        </label>

        {file ? (
          <span className="ml-3 text-sm text-brandBlueLight">{file.name}</span>
        ) : null}

        {uploading ? (
          <span className="ml-3 text-sm text-brandBlueLight/70">
            Uploading...
          </span>
        ) : null}
      </div>

      <form onSubmit={sendMessage} className="flex gap-3">
        <input
          className="flex-1 rounded-xl border border-brandBlue bg-brandNavy p-3 text-white"
          placeholder="Ask Prospra anything…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />

        <button
          type="submit"
          className="rounded-xl bg-brandOrange px-5 py-3 font-semibold hover:bg-brandOrangeLight disabled:cursor-not-allowed disabled:opacity-60"
          disabled={loading || uploading}
        >
          Send
        </button>
      </form>
    </div>
  );
}
