import { AuthForm } from "@/components/store/auth-form";

export const metadata = { title: "Регистрация" };

export default function RegisterPage() {
  return (
    <div className="container max-w-md py-16 md:py-24">
      <h1 className="h-display mb-10 text-5xl">Регистрация</h1>
      <AuthForm mode="register" />
    </div>
  );
}
