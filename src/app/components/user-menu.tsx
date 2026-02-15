import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { SignInButton, UserMenuPopover } from "./user-menu-client";

export async function UserMenu() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return <SignInButton />;
  }

  return <UserMenuPopover user={session.user} />;
}
