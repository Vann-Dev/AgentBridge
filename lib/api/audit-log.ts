import { prisma } from "@/lib/prisma"

type AuditActor = {
  type: "user" | "agent" | "system"
  id?: string | null
  name?: string | null
}

type AuditTarget = {
  type: string
  id?: string | null
  name?: string | null
}

type AuditLogInput = {
  companyId: string
  action: string
  target: AuditTarget
  actor: AuditActor
  details?: string | null
}

export async function createAuditLog({
  companyId,
  action,
  target,
  actor,
  details,
}: AuditLogInput) {
  await prisma.auditLog.create({
    data: {
      companyId,
      action,
      targetType: target.type,
      targetId: target.id ?? null,
      targetName: target.name ?? null,
      actorType: actor.type,
      actorId: actor.id ?? null,
      actorName: actor.name ?? null,
      details: details ?? null,
    },
  })
}

export function formatChangedFields(changes: Array<string | false | null | undefined>) {
  const fields = changes.filter(Boolean)

  if (fields.length === 0) return null

  return `Updated ${fields.join(", ")}.`
}
