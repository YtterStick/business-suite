"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const GOOGLE_AUTH_ERROR_MESSAGES: Record<string, string> = {
  google_not_configured:
    "Google sign-in isn't configured yet. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to your .env file.",
  google_state: "Your Google sign-in session expired. Please try again.",
  google_denied: "Google sign-in was cancelled.",
  google_email_unverified: "Your Google account email isn't verified.",
  google_failed: "We couldn't sign you in with Google. Please try again.",
};

/** Reads `?error=` set by the Google OAuth callback and returns a friendly message. */
export function useGoogleAuthError(): string | null {
  const [message, setMessage] = React.useState<string | null>(null);
  React.useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("error");
    if (code) {
      setMessage(GOOGLE_AUTH_ERROR_MESSAGES[code] ?? GOOGLE_AUTH_ERROR_MESSAGES.google_failed!);
    }
  }, []);
  return message;
}

function GoogleGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z"
      />
      <path
        fill="#FF3D00"
        d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z"
      />
    </svg>
  );
}

export function GoogleAuthButton({
  mode,
  label = "Continue with Google",
}: {
  mode: "login" | "signup";
  label?: string;
}) {
  const [loading, setLoading] = React.useState(false);

  // Reset the spinner if the user navigates back from Google (bfcache restore).
  React.useEffect(() => {
    const reset = () => setLoading(false);
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);

  return (
    <a
      href={`/api/auth/google?mode=${mode}`}
      onClick={() => setLoading(true)}
      aria-disabled={loading}
      className={cn(
        buttonVariants({ variant: "outline" }),
        "h-10 w-full gap-2.5 font-medium transition-all hover:-translate-y-px hover:shadow-md",
        loading && "pointer-events-none opacity-70",
      )}
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <GoogleGlyph className="size-4" />
      )}
      {label}
    </a>
  );
}

export function AuthDivider({ label = "or continue with email" }: { label?: string }) {
  return (
    <div className="relative my-5 flex items-center gap-3">
      <span className="h-px flex-1 bg-border" />
      <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
