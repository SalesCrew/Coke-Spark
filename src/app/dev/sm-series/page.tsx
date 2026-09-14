import { notFound } from "next/navigation";
import { readFile } from "node:fs/promises";
import path from "node:path";
import Preview from "./preview";

export default async function Page() {
  if (process.env.NODE_ENV !== "development") notFound();
  // Use the actual planning styles; this local fixture never loads or writes app data.
  const source = await readFile(path.join(process.cwd(), "src/components/admin/sm/SmVerplanungWorkspace.tsx"), "utf8");
  const styles = source.split(/\r?\n/).filter((line) => line.trim().startsWith(".sm-plan-")).join("\n").replaceAll("${RED}", "#DC2626");
  return <Preview styles={styles}/>;
}
