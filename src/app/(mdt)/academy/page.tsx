import type { Metadata } from "next";

import { Panel, PanelHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/guard";
import { canSuperviseAcademy } from "@/lib/permissions";
import { AddSlotForm } from "./forms";
import { PlanningGrid } from "./planning-grid";

export const metadata: Metadata = { title: "Planning académique" };

const DAY_NAMES = [
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
  "Dimanche",
];

export default async function AcademyPlanningPage() {
  const user = await requireModule("academy");
  const canEdit = canSuperviseAcademy(user);

  const slots = await db.academyScheduleSlot.findMany({
    orderBy: [{ dayOfWeek: "asc" }, { startMin: "asc" }],
  });

  // Semaine courante (lundi → dimanche) avec la date de chaque jour.
  const now = new Date();
  const dow = (now.getDay() + 6) % 7; // 0 = lundi
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow);
  const days = DAY_NAMES.map((name, i) => {
    const d = new Date(
      monday.getFullYear(),
      monday.getMonth(),
      monday.getDate() + i,
    );
    return {
      name,
      date: `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-mist-100">
          Planning académique
        </h1>
        <p className="mt-1 text-sm text-mist-500">
          Créneaux de formation de la semaine.
        </p>
      </div>

      <Panel className="overflow-hidden">
        <PlanningGrid
          days={days}
          todayIndex={dow}
          slots={slots.map((s) => ({
            id: s.id,
            dayOfWeek: s.dayOfWeek,
            startMin: s.startMin,
            endMin: s.endMin,
            title: s.title,
            location: s.location,
            details: s.details,
          }))}
          canEdit={canEdit}
        />
      </Panel>

      {canEdit ? (
        <Panel className="max-w-2xl border-badge-500/30">
          <PanelHeader
            title="Ajouter un créneau"
            subtitle="Cours, session ou évaluation récurrente dans la semaine"
          />
          <AddSlotForm />
        </Panel>
      ) : null}
    </div>
  );
}
