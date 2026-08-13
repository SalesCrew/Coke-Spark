import { GmTextScaleProvider } from "@/components/dashboard/GmTextScaleProvider";

export default function SmLayout({ children }: { children: React.ReactNode }) {
  return <GmTextScaleProvider scope="sm">{children}</GmTextScaleProvider>;
}
