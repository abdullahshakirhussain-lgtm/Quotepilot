import { Suspense } from "react";
import AuthForm from "@/components/auth/AuthForm";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-4 py-10">
      <Suspense>
        <AuthForm mode="login" />
      </Suspense>
    </main>
  );
}
