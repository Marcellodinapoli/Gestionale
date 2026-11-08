import { timingSafeEqual } from "node:crypto";

const HEADER = "x-assistenza-role-verify-secret";

export function assistenzaRoleVerifyHeaderName(): string {
  return HEADER;
}

export function assertAssistenzaRoleVerifySecret(
  headerValue: string | null,
): boolean {
  const expected = (process.env.ASSISTENZA_ROLE_VERIFY_SECRET || "").trim();
  if (!expected) return false;
  const got = (headerValue || "").trim();
  if (!got) return false;
  try {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(got, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
