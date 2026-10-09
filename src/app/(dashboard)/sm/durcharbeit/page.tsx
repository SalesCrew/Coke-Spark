import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SmSMDurcharbeitTargets } from "@/components/dashboard/SmSMDurcharbeitTargets";
import { SmDashboardNavigation } from "@/components/sm/SmDashboardNavigation";

export default function SmDurcharbeitPage() {
  return <main className="min-h-screen bg-[#f5f5f7] px-6 pb-[calc(100px+env(safe-area-inset-bottom))] pt-6">
    <div className="mx-auto max-w-[420px]">
      <Link href="/sm" className="mb-6 inline-flex min-h-10 items-center gap-2 rounded-lg text-[12px] font-medium text-gray-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"><ArrowLeft size={16} />Home</Link>
      <header className="mb-6"><h1 className="text-[24px] font-semibold tracking-tight text-gray-900">Durcharbeit</h1><p className="mt-1 text-[12px] leading-5 text-gray-600">Deine Märkte für diesen Monat.</p></header>
      <SmSMDurcharbeitTargets />
    </div>
    <div className="fixed bottom-[max(24px,env(safe-area-inset-bottom))] left-0 right-0 z-50"><SmDashboardNavigation /></div>
  </main>;
}
