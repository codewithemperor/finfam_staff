import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { AdminLoginForm } from "@/components/admin/admin-login-form";
import { ReleaseInProgress } from "@/components/release/release-in-progress";
import { getAdminSession } from "@/lib/auth/admin-session";
import { isReleaseAvailable } from "@/server/config/release";

export const metadata: Metadata = {
  title: "Administrator Sign In",
  description:
    "Sign in to the FinFam Admin console with a secure sign-in code sent to your administrator email address.",
};

/**
 * /admin/login — Admin console entry (Stage 11). Step 1 of the email-OTP
 * flow lives in the client form; this server page only decides whether the
 * screen is needed at all: an already-authenticated administrator goes
 * straight to the console. /admin/login lives OUTSIDE the guarded
 * (dashboard) route group, so the guard never loops.
 */
export default async function AdminLoginPage() {
  await connection();

  if (!isReleaseAvailable("admin")) {
    return <ReleaseInProgress area="admin" />;
  }

  const session = await getAdminSession();
  if (session) {
    redirect("/admin");
  }

  return (
    <main className="grid min-h-[100dvh] bg-background lg:grid-cols-2">
      <section className="hidden bg-primary px-10 py-12 text-primary-foreground lg:flex lg:flex-col lg:justify-between xl:px-16">
        <div>
          <div className="grid size-14 place-items-center rounded-full bg-white">
            <Image
              src="/icon-192.png"
              alt="FinFam"
              width={56}
              height={56}
              className="size-14 object-contain"
              priority
            />
          </div>
          <p className="mt-8 max-w-sm text-4xl font-bold tracking-tight">
            FinFam Admin
          </p>
          <p className="mt-3 max-w-sm text-base leading-7 text-primary-foreground/80">
            Management access for the FinFam recruitment operation.
          </p>
        </div>
        <p className="text-sm text-primary-foreground/65">Management console</p>
      </section>

      <section className="flex min-h-[100dvh] items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-[28rem]">
          <div className="lg:hidden">
            <Image
              src="/icon-192.png"
              alt="FinFam"
              width={48}
              height={48}
              className="size-12 object-contain"
              priority
            />
          </div>
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            Admin Portal
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">
            Welcome back
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Enter your registered admin email to receive a secure 6-digit
            sign-in code.
          </p>
          <div className="mt-8">
            <AdminLoginForm />
          </div>
        </div>
      </section>
    </main>
  );
}
