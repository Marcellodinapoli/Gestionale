import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  creditcalcPairQrPayload,
  resolveCreditcalcBffPublicUrl,
} from "./bffPublicUrl";

describe("resolveCreditcalcBffPublicUrl", () => {
  it("uses env when set", () => {
    const prev = process.env.CREDIXA_BFF_PUBLIC_URL;
    process.env.CREDIXA_BFF_PUBLIC_URL = "https://bff.example/app/";
    try {
      const req = new Request("http://ignored");
      assert.equal(resolveCreditcalcBffPublicUrl(req), "https://bff.example/app");
    } finally {
      if (prev === undefined) delete process.env.CREDIXA_BFF_PUBLIC_URL;
      else process.env.CREDIXA_BFF_PUBLIC_URL = prev;
    }
  });

  it("builds pair QR path", () => {
    const req = new Request("https://gestionale.test", {
      headers: {
        host: "gestionale.test",
        "x-forwarded-proto": "https",
      },
    });
    assert.equal(
      creditcalcPairQrPayload(req, "00000000-0000-4000-8000-000000000001"),
      "https://gestionale.test/creditcalc/pair/00000000-0000-4000-8000-000000000001"
    );
  });

  it("replaces localhost with CREDIXA_BFF_LAN_HOST", () => {
    const prev = process.env.CREDIXA_BFF_LAN_HOST;
    const prevPublic = process.env.CREDIXA_BFF_PUBLIC_URL;
    delete process.env.CREDIXA_BFF_PUBLIC_URL;
    delete process.env.NEXT_PUBLIC_CREDIXA_BFF_URL;
    process.env.CREDIXA_BFF_LAN_HOST = "192.168.1.99";
    try {
      const req = new Request("http://localhost:3100/account", {
        headers: { host: "localhost:3100" },
      });
      assert.equal(
        resolveCreditcalcBffPublicUrl(req),
        "http://192.168.1.99:3100"
      );
    } finally {
      if (prev === undefined) delete process.env.CREDIXA_BFF_LAN_HOST;
      else process.env.CREDIXA_BFF_LAN_HOST = prev;
      if (prevPublic === undefined) delete process.env.CREDIXA_BFF_PUBLIC_URL;
      else process.env.CREDIXA_BFF_PUBLIC_URL = prevPublic;
    }
  });
});
