import { GmTextScaleProvider } from "@/components/dashboard/GmTextScaleProvider";

export default function GmLayout({ children }: { children: React.ReactNode }) {
  return <GmTextScaleProvider>{children}</GmTextScaleProvider>;
}
