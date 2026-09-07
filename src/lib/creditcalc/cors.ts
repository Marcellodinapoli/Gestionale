import { NextResponse } from "next/server";

/** CORS per client CreditCalc (mobile/web) verso il BFF. */
export function creditCalcCorsHeaders(req?: Request): HeadersInit {
  const origin = req?.headers.get("origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin === "null" ? "*" : origin,
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function withCreditCalcCors(res: NextResponse, req?: Request): NextResponse {
  const headers = creditCalcCorsHeaders(req);
  for (const [k, v] of Object.entries(headers)) {
    res.headers.set(k, v);
  }
  return res;
}

export function creditCalcOptions(req: Request) {
  return withCreditCalcCors(new NextResponse(null, { status: 204 }), req);
}

export function jsonOk(data: unknown, req?: Request, init?: ResponseInit) {
  return withCreditCalcCors(NextResponse.json(data, init), req);
}

export function jsonErr(message: string, status: number, req?: Request) {
  return withCreditCalcCors(NextResponse.json({ error: message }, { status }), req);
}
