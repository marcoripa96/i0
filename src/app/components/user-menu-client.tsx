"use client";

import { authClient } from "@/lib/auth-client";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function SignInButton() {
  return (
    <button
      onClick={() => authClient.signIn.social({ provider: "github" })}
      className="font-mono text-[10px] text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
    >
      [sign in]
    </button>
  );
}

export function UserMenuPopover({
  user,
}: {
  user: { name: string; email: string; image: string | null };
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground transition-colors hover:text-foreground cursor-pointer">
          {user.image ? (
            <img src={user.image} alt="" className="size-4 rounded-full" />
          ) : (
            <span className="flex size-4 items-center justify-center rounded-full bg-muted text-[8px] font-medium">
              {user.name?.charAt(0)?.toUpperCase()}
            </span>
          )}
          [{user.name}]
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-48 p-2">
        <div className="flex flex-col gap-2">
          <div className="px-2 py-1">
            <p className="font-mono text-xs font-medium truncate">
              {user.name}
            </p>
            <p className="font-mono text-[10px] text-muted-foreground truncate">
              {user.email}
            </p>
          </div>
          <div className="h-px bg-border" />
          <button
            onClick={() => authClient.signOut()}
            className="w-full rounded px-2 py-1 text-left font-mono text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer"
          >
            sign out
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
