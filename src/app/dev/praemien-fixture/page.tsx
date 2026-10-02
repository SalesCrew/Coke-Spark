import { notFound } from "next/navigation";
import { PraemienFixtureEntry } from "@/components/admin/praemien/PraemienFixtureEntry";

export default function FixturePage() {
  if (process.env.NODE_ENV === "production" || !/^http:\/\/(127\.0\.0\.1|localhost):4017$/.test(process.env.NEXT_PUBLIC_BACKEND_URL ?? "")) notFound();
  return <PraemienFixtureEntry />;
}
