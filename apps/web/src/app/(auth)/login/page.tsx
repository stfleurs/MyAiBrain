import type { Metadata } from "next";
import { LoginForm } from "@/components/LoginForm";

export const metadata: Metadata = {
  title: "Sign in — Personal AI Memory",
};

export default function LoginPage() {
  return (
    <main className="page page-narrow">
      <LoginForm />
    </main>
  );
}
