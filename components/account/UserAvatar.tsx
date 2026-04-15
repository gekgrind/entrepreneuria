import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type UserAvatarProps = {
  fullName: string | null;
  email: string | null;
  avatarUrl: string | null;
  className?: string;
};

function getFallbackInitial(fullName: string | null, email: string | null) {
  const source = (fullName && fullName.trim()) || (email && email.trim()) || "U";
  const character = source.charAt(0).toUpperCase();

  return character || "U";
}

export function UserAvatar({
  fullName,
  email,
  avatarUrl,
  className,
}: UserAvatarProps) {
  const initial = getFallbackInitial(fullName, email);

  return (
    <Avatar className={className}>
      {avatarUrl ? <AvatarImage src={avatarUrl} alt={fullName ?? email ?? "User avatar"} /> : null}
      <AvatarFallback>{initial}</AvatarFallback>
    </Avatar>
  );
}