"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { useUser } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";

type AvatarManagementFormProps = {
  currentAvatarUrl: string | null;
};

export function AvatarManagementForm({ currentAvatarUrl }: AvatarManagementFormProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const router = useRouter();
  const { refreshUser } = useUser();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const file = fileInputRef.current?.files?.[0];

    if (!file) {
      setError("Please select an image before uploading.");
      return;
    }

    const formData = new FormData();
    formData.append("avatar", file);

    const response = await fetch("/api/account/avatar", {
      method: "POST",
      body: formData,
    });

    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
    };

    if (!response.ok) {
      setError(payload.error ?? "Avatar upload failed.");
      return;
    }

    setSuccess("Avatar updated.");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    await refreshUser();

    startTransition(() => {
      router.refresh();
    });
  }

  async function handleRemoveAvatar() {
    setError(null);
    setSuccess(null);

    const response = await fetch("/api/account/avatar", {
      method: "DELETE",
    });

    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
    };

    if (!response.ok) {
      setError(payload.error ?? "Could not remove avatar.");
      return;
    }

    setSuccess("Avatar removed.");
    await refreshUser();

    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        name="avatar"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="block w-full text-sm"
        disabled={isPending}
      />

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving..." : "Upload avatar"}
        </Button>

        <Button
          type="button"
          variant="outline"
          disabled={isPending || !currentAvatarUrl}
          onClick={handleRemoveAvatar}
        >
          Remove avatar
        </Button>
      </div>

      {error ? <p className="text-sm text-red-500">{error}</p> : null}
      {success ? <p className="text-sm text-green-600">{success}</p> : null}
    </form>
  );
}
