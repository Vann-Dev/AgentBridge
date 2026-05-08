import { NextResponse } from "next/server"

import { badRequest, requireInternalSession } from "@/lib/api/internal"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const { session, response } = await requireInternalSession()

  if (response) return response

  const companies = await prisma.company.findMany({
    where: { userId: session.userId },
    orderBy: { name: "asc" },
  })

  return NextResponse.json({ statusCode: 200, companies })
}

export async function POST(request: Request) {
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

  const company = await prisma.company.create({
    data: {
      name,
      description,
      userId: session.userId,
    },
  })

  return NextResponse.json({ statusCode: 201, company }, { status: 201 })
}
