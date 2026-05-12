import { NextResponse } from "next/server"

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

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { session, response } = await requireInternalSession()

  if (response) return response

  const { companyId } = await params
  const company = await prisma.company.findFirst({
    where: { id: companyId, userId: session.userId },
  })

  if (!company) {
    return notFound("Company not found.")
  }

  await prisma.company.delete({ where: { id: company.id } })

  return NextResponse.json({ statusCode: 200, companyId: company.id })
}

export async function POST(_request: Request, { params }: RouteContext) {
  const { session, response } = await requireInternalSession()

  if (response) return response

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

  return NextResponse.json({ statusCode: 200, token })
}
