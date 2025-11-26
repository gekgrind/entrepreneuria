"use client";

import { useChat } from "ai/react";
import { useState } from "react";

export default function ChatPage() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } =
    useChat({
      api: "/api/chat",
    });

  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  function handleFileChange(e) {
    const selected = e.target.files?.[0] || null;
    setFile(selected);
  }

  async function uploadFile() {
    if (!file) return null;

    setUploading(true);

    const form = new FormData();
    form.append("file", file);

    try {
      const res = await fetch("/api/upload-file", {
        method: "POST",
        body: form,
      });

      const data = await res.json();
      return data.url || null;
    } catch (err) {
      console.error(err);
      return null;
    } finally {
      setUploading(false);
      setFile(null);
    }
  }

  async function onSubmit(e) {
    e.preventDefault();

    if (!input.trim() && !file) return;

    // upload file first if exists
    const fileUrl = await uploadFile();

    if (fileUrl) {
      // Append file URL to input before sending
      const event = {
        ...e,
        target: {
          ...e.target,
          value: input + "\n\nAttached File:\n" + fileUrl,
        },
      } as any;

      handleSubmit(event);
    } else {
      handleSubmit(e);
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6 text-white">
      <h1 className="text-3xl font-bold text-center mb-6">
        Prospra AI Mentor 🤖
      </h1>

      {/* Messages */}
      <div className="bg-brandNavy/60 border border-brandBlue rounded-xl p-4 h-[400px] overflow-y-auto mb-6">
        {messages.length === 0 && (
          <p className="text-brandBlueLight/60 text-center">
            Ask a question or attach a file to begin.
          </p>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={
              "p-3 mb-3 rounded-xl max-w-[80%] " +
              (m.role === "user"
                ? "bg-brandBlueLight/20 ml-auto"
                : "bg-brandNavy/80 border border-brandBlue")
            }
          >
            <p className="text-sm whitespace-pre-wrap">{m.content}</p>
          </div>
        ))}

        {isLoading && (
          <div className="bg-brandNavy/80 border border-brandBlue p-3 rounded-xl max-w-[60%]">
            Thinking…
          </div>
        )}
      </div>

      {/* File Upload */}
      <div className="mb-3">
        <label className="px-3 py-2 inline-block bg-brandNavy border border-brandBlue rounded-xl cursor-pointer">
          📎 Attach File
          <input
            type="file"
            className="hidden"
            onChange={handleFileChange}
          />
        </label>

        {file && (
          <span className="ml-3 text-sm text-brandBlueLight">
            {file.name}
          </span>
        )}

        {uploading && (
          <span className="ml-3 text-sm text-brandBlueLight/70">
            Uploading...
          </span>
        )}
      </div>

      {/* Input */}
      <form onSubmit={onSubmit} className="flex gap-3">
        <input
          className="flex-1 p-3 bg-brandNavy border border-brandBlue rounded-xl text-white"
          placeholder="Ask Prospra anything…"
          value={input}
          onChange={handleInputChange}
        />

        <button
          type="submit"
          className="bg-brandOrange px-5 py-3 rounded-xl font-semibold hover:bg-brandOrangeLight"
          disabled={isLoading || uploading}
        >
          Send
        </button>
      </form>
    </div>
  );
}
