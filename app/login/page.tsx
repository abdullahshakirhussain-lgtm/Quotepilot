import AuthForm from "@/components/auth/AuthForm";

type Props = { searchParams: Promise<{ redirect?: string | string[]; error?: string | string[] }> };
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? null;

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams;
  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-4 py-10">
      <AuthForm mode="login" redirect={first(params.redirect)} error={first(params.error)} />
    </main>
  );
}
