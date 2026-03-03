"use client";

import { CollapsibleMenu, defaultMenuItems } from "@/components/ui/CollapsibleMenu";
import { StatusCard } from "@/components/dashboard/StatusCard";
import { AssignmentList } from "@/components/dashboard/AssignmentList";
import { WeekStrip } from "@/components/dashboard/WeekStrip";
import { NachrichtenCard } from "@/components/dashboard/NachrichtenCard";

export default function SMDashboard() {
  return (
    <main className="min-h-screen" style={{ backgroundColor: "#f5f5f7" }}>
      <div className="px-6 pt-6" style={{ maxWidth: 420, margin: "0 auto" }}>
        <StatusCard />
        <div className="mt-5 px-1">
          <AssignmentList />
        </div>
        <div className="mt-6 px-1">
          <WeekStrip />
        </div>
        <div className="mt-4 px-1">
          <NachrichtenCard />
        </div>
      </div>

      <div className="fixed bottom-6 left-0 right-0 z-50">
        <CollapsibleMenu items={defaultMenuItems} defaultIndex={0} />
      </div>
    </main>
  );
}
