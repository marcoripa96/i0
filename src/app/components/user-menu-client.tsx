"use client";

import { authClient } from "@/lib/auth-client";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ApiTokenDialog } from "./api-token-dialog";
import { LogoutIcon } from "./icons";

export function SignInButton() {
  return (
    <button
      onClick={() => authClient.signIn.social({ provider: "github" })}
      className="font-mono text-xs text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
    >
      [sign in]
    </button>
  );
}

export function UserMenuPopover({
  user,
}: {
  user: { name: string; email: string; image?: string | null };
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground cursor-pointer">
          {user.image ? (
            <img src={user.image} alt="" className="size-5 rounded-full" />
          ) : (
            <span className="flex size-5 items-center justify-center rounded-full bg-muted text-[10px] font-medium">
              {user.name?.charAt(0)?.toUpperCase()}
            </span>
          )}
          [{user.name}]
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-52 p-2">
        <div className="flex flex-col gap-2">
          <div className="px-2 py-1.5">
            <p className="font-mono text-sm font-medium truncate">
              {user.name}
            </p>
            <p className="font-mono text-xs text-muted-foreground truncate">
              {user.email}
            </p>
          </div>
          <div className="h-px bg-border" />
          <ApiTokenDialog />
          <button
            onClick={() => authClient.signOut()}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left font-mono text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer"
          >
            <LogoutIcon className="shrink-0 size-[16px]" />
            sign out
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
