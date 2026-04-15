import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type UserAvatarProps = {
  avatarUrl: string | null;
  displayName: string | null;
  email: string | null;
  className?: string;
};

function getInitial(input: string | null) {
  const source = input?.trim();

  if (!source) {
    return "U";
  }

  return source.charAt(0).toUpperCase();
}

export function UserAvatar({ avatarUrl, displayName, email, className }: UserAvatarProps) {
  const fallbackInitial = getInitial(displayName ?? email);

  return (
    <Avatar className={className}>
      <AvatarImage src={avatarUrl ?? undefined} alt={displayName ?? email ?? "User avatar"} />
      <AvatarFallback>{fallbackInitial}</AvatarFallback>
    </Avatar>
  );
}
