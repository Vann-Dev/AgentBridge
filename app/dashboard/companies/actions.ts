"use server"

import { redirect } from "next/navigation"

import { getSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function createCompany(_state: string | null, formData: FormData) {
  const session = await getSession()

  if (!session) {
    redirect("/login")
  }

  const name = String(formData.get("name") ?? "").trim()
  const description = String(formData.get("description") ?? "").trim()

  if (!name) {
    return "Company name is required."
  }

  const company = await prisma.company.create({
    data: {
      name,
      description,
      userId: session.userId,
    },
  })

  redirect(`/dashboard?company=${company.id}`)
}
