import { NextResponse } from "next/server"

import { createAuditLog } from "@/lib/api/audit-log"
import { badRequest, notFound, requireInternalSession } from "@/lib/api/internal"
import { prisma } from "@/lib/prisma"
import { generateCompanyBearerToken } from "@/lib/token"

type RouteContext = {
  params: Promise<{ companyId: string }>
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { session, response } = await requireInternalSession()

  if (response) return response

  const body = (await request.json().catch(() => null)) as {
    name?: unknown
    description?: unknown
  } | null
  const name = typeof body?.name === "string" ? body.name.trim() : ""
  const description = typeof body?.description === "string" ? body.description.trim() : ""

  if (!name) {
    return badRequest("Company name is required.")
  }

  const { companyId } = await params
  const company = await prisma.company.findFirst({
    where: { id: companyId, userId: session.userId },
  })

  if (!company) {
    return notFound("Company not found.")
  }

  const updatedCompany = await prisma.company.update({
    where: { id: company.id },
    data: { name, description },
    omit: { bearerTokenHash: true },
  })

  return NextResponse.json({ statusCode: 200, company: updatedCompany })
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const { session, response } = await requireInternalSession()

  if (response) return response

  const body = (await request.json().catch(() => null)) as {
    confirmationName?: unknown
  } | null
  const confirmationName =
    typeof body?.confirmationName === "string" ? body.confirmationName.trim() : ""

  const { companyId } = await params
  const company = await prisma.company.findFirst({
    where: { id: companyId, userId: session.userId },
  })

  if (!company) {
    return notFound("Company not found.")
  }

  if (confirmationName !== company.name) {
    return badRequest("Type the company name exactly to delete this company.")
  }

  await prisma.company.delete({ where: { id: company.id } })

  return NextResponse.json({ statusCode: 200, companyId: company.id })
}

export async function POST(request: Request, { params }: RouteContext) {
  const { session, response } = await requireInternalSession()

  if (response) return response

  const body = (await request.json().catch(() => null)) as {
    confirmRotation?: unknown
  } | null

  if (body?.confirmRotation !== true) {
    return badRequest("Confirm token rotation before generating a new company token.")
  }

  const { companyId } = await params
  const company = await prisma.company.findFirst({
    where: { id: companyId, userId: session.userId },
  })

  if (!company) {
    return notFound("Company not found.")
  }

  const { token, bearerTokenHash } = generateCompanyBearerToken()

  await prisma.company.update({
    where: { id: company.id },
    data: { bearerTokenHash },
  })

  await createAuditLog({
    companyId: company.id,
    action: "company.token_rotated",
    target: { type: "company", id: company.id, name: company.name },
    actor: { type: "user", id: session.userId, name: session.username },
    details:
      "Rotated the company bearer token. Existing external agent configs must be updated.",
  })

  return NextResponse.json({ statusCode: 200, token })
}
