import VoucherForm from "./voucher-form";

export default async function VoucherPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <VoucherForm code={decodeURIComponent(code)} />;
}
