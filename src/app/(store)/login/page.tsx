import { AuthForm } from "@/components/store/auth-form";

export const metadata = { title: "Вход" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <div className="container max-w-md py-16 md:py-24">
      <h1 className="h-display mb-10 text-5xl">Вход</h1>
      <AuthForm mode="login" next={next} />
    </div>
  );
}
