import { NextResponse } from "next/server"
import { createOpenApiDocument } from "@/lib/api/openapi"

export function GET() {
  return NextResponse.json(createOpenApiDocument())
}
