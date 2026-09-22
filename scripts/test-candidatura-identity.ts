/**
 * Test puro: confronto sicuro email/telefono candidature.
 */
import assert from "node:assert/strict";
import {
  contactsLikelySamePerson,
  normalizeEmailForMatch,
  normalizePhoneForMatch,
  pickContactDuplicate,
} from "../src/lib/recruiting/candidaturaIdentity.ts";

assert.equal(normalizeEmailForMatch("  Mario.Rossi@Example.COM "), "mario.rossi@example.com");
assert.equal(normalizeEmailForMatch("not-an-email"), null);
assert.equal(normalizePhoneForMatch("+39 333 1234567"), "3331234567");
assert.equal(normalizePhoneForMatch("00393331234567"), "3331234567");
assert.equal(normalizePhoneForMatch("123"), null);

assert.equal(
  contactsLikelySamePerson(
    { email: "a@b.it", phone: null },
    { email: "A@B.IT", phone: "333" }
  ),
  "email"
);

assert.equal(
  contactsLikelySamePerson(
    { email: null, phone: "333 1234567" },
    { email: null, phone: "+39 3331234567" }
  ),
  "phone"
);

assert.equal(
  contactsLikelySamePerson(
    { email: "a@b.it", phone: "3331234567" },
    { email: "altro@b.it", phone: "3331234567" }
  ),
  null,
  "telefono uguale ma email diverse → no match"
);

assert.equal(
  contactsLikelySamePerson(
    { email: null, phone: null },
    { email: null, phone: null }
  ),
  null
);

const picked = pickContactDuplicate(
  { email: "x@y.it", phone: "3331112233" },
  [
    { id: "1", email: "z@y.it", phone: "999" },
    { id: "2", email: "X@Y.IT", phone: null },
  ]
);
assert.deepEqual(picked, { id: "2", reason: "email" });

console.log(JSON.stringify({ ok: true }));
