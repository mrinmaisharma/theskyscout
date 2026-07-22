import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, verifyAdminSession } from "@/lib/admin-auth";
import AdminVoucherManager from "./voucher-manager";

export const dynamic = "force-dynamic";

export default async function AdminVouchersPage() {
  const cookieStore = await cookies();
  if (!(await verifyAdminSession(cookieStore.get(ADMIN_COOKIE)?.value))) redirect("/admin/login");
  return <AdminVoucherManager />;
}
