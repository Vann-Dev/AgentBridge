import { createHash, randomBytes } from "node:crypto"

export function generateCompanyBearerToken() {
  const token = `cmp_${randomBytes(32).toString("base64url")}`
  const bearerTokenHash = createHash("sha256").update(token).digest("hex")

  return { token, bearerTokenHash }
}
