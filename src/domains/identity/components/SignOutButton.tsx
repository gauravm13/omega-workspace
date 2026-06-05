"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button 
      onClick={() => signOut({ callbackUrl: "/" })}
      className="text-xs font-medium text-red-600 bg-red-50 border border-red-200 px-3 py-1.5 rounded hover:bg-red-100 transition-colors"
    >
      Sign Out
    </button>
  );
}