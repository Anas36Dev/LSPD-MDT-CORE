"use server";

import { revalidatePath } from "next/cache";

import { audit } from "@/lib/auth";
import { db } from "@/lib/db";
import { assertPermission } from "@/lib/guard";
import { can } from "@/lib/permissions";

export type FscState = { error?: string; success?: string } | undefined;

const fail = (error: string): FscState => ({ error });

/** FSC-2026-0042 */
async function nextReference() {
  const year = new Date().getFullYear();
  const prefix = `FSC-${year}-`;

  const last = await db.firearmCertificate.findFirst({
    where: { reference: { startsWith: prefix } },
    orderBy: { reference: "desc" },
    select: { reference: true },
  });

  const seq = last ? Number(last.reference.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

export async function issueCertificate(
  _state: FscState,
  formData: FormData,
): Promise<FscState> {
  try {
    // Seuls les titulaires de l'habilitation IFSC délivrent un certificat.
    const user = await assertPermission(can.issueFirearmCertificate);

    // Identité saisie librement : la base civile n'est plus nécessaire.
    const subjectName = String(formData.get("subjectName") ?? "").trim();
    if (!subjectName) return fail("Saisissez le prénom et le nom du titulaire.");

    const expiresRaw = String(formData.get("expiresAt") ?? "").trim();

    const certificate = await db.firearmCertificate.create({
      data: {
        reference: await nextReference(),
        subjectName,
        issuedById: user.id,
        expiresAt: expiresRaw ? new Date(expiresRaw) : null,
      },
    });

    await audit({
      userId: user.id,
      action: "FSC_ISSUE",
      targetType: "FirearmCertificate",
      targetId: certificate.id,
      detail: `${certificate.reference} — ${subjectName}`,
    });

    revalidatePath("/firearm-certificates");
    return { success: `Certificat ${certificate.reference} délivré à ${subjectName}.` };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Erreur inattendue.");
  }
}

export async function revokeCertificate(
  _state: FscState,
  formData: FormData,
): Promise<FscState> {
  try {
    const user = await assertPermission(can.issueFirearmCertificate);

    const id = Number(formData.get("certificateId"));
    const reason = String(formData.get("revokeReason") ?? "").trim();

    if (!reason) return fail("La révocation doit être motivée.");

    const certificate = await db.firearmCertificate.findUnique({
      where: { id },
    });
    if (!certificate) return fail("Certificat introuvable.");
    if (certificate.status !== "VALID") {
      return fail("Ce certificat n'est plus en vigueur.");
    }

    await db.firearmCertificate.update({
      where: { id },
      data: { status: "REVOKED", revokedAt: new Date(), revokeReason: reason },
    });

    await audit({
      userId: user.id,
      action: "FSC_REVOKE",
      targetType: "FirearmCertificate",
      targetId: certificate.id,
      detail: `${certificate.reference} — ${reason}`,
    });

    revalidatePath("/firearm-certificates");
    return { success: `Certificat ${certificate.reference} révoqué.` };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Erreur inattendue.");
  }
}
