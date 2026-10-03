import Link from "next/link";
import { brand } from "@/lib/config";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <header className="px-4 py-5 sm:px-8">
        <Link href="/" className="text-lg font-extrabold text-brand">{brand.name}</Link>
      </header>
      <main id="contenu" className="flex flex-1 items-start justify-center px-4 pb-16 pt-4 sm:pt-12">
        <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-sm ring-1 ring-line sm:p-8">{children}</div>
      </main>
    </div>
  );
}
