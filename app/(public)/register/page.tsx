import { redirect } from "next/navigation";

export default async function RegisterRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const redirectParam = typeof params.redirect === 'string' ? params.redirect : '';
  const queryString = redirectParam ? `&redirect=${encodeURIComponent(redirectParam)}` : '';
  redirect(`/login?tab=signup${queryString}`);
}
