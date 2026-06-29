"use client";

import { usePathname } from "next/navigation";
import Navbar from "@/components/Navbar";
import AdminSidebar from "@/components/AdminSidebar";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/admin/login";

  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <>
      <Navbar />
      <div className="flex min-h-screen">
        <AdminSidebar />
        <main className="flex-1 pt-20 p-8">{children}</main>
      </div>
    </>
  );
}
