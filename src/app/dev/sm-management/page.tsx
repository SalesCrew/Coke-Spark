import { notFound } from "next/navigation";
import Preview from "./preview";

export default function Page() {
  if (process.env.NODE_ENV !== "development" || process.env.SM_MANAGEMENT_BROWSER_FIXTURE !== "1") notFound();
  return <Preview />;
}
