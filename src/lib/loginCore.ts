import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/domain";
import {
  mustChoosePostazioneAlLogin,
  type Role,
  type SessionUser,
} from "@/lib/permissions";
import { isPasswordExpired } from "@/lib/passwordPolicy";
import { normalizeTenantSlug } from "@/lib/tenant";

export type LoginInput = {
  email?: string;
  password?: string;
  tenantSlug?: string;
};

export type LoginSuccess = {
  ok: true;
  href: string;
  session: SessionUser;
};

export type LoginFailure = { error: string };

export type LoginResult = LoginSuccess | LoginFailure;

function loginError(message: string): LoginFailure {
  return { error: message };
}

/** Autentica credenziali e calcola redirect post-login (senza impostare cookie). */
export async function authenticateLogin(input: LoginInput): Promise<LoginResult> {
  const email = String(input?.email || "")
    .trim()
    .toLowerCase();
  const password = String(input?.password || "");
  const slug = normalizeTenantSlug(String(input?.tenantSlug || ""));
  if (!slug) return loginError("Inserisci il codice azienda");
  if (!email) return loginError("Inserisci l'email");
  if (!password) return loginError("Inserisci la password");

  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant || tenant.active === false) {
    return loginError("Azienda non trovata o non attiva");
  }

  const user = await prisma.user.findUnique({
    where: { tenantId_email: { tenantId: tenant.id, email } },
  });
  if (!user) {
    console.error("[login] utente assente", { slug, email, tenantId: tenant.id });
    return loginError("Credenziali non valide");
  }
  if (user.active === false) {
    console.error("[login] utente disattivo", { email });
    return loginError("Credenziali non valide");
  }

  const hash = String(user.passwordHash || "");
  const ok = hash ? await bcrypt.compare(password, hash) : false;
  if (!ok) {
    console.error("[login] password non valida", {
      email,
      hashLen: hash.length,
      passwordLen: password.length,
    });
    return loginError("Credenziali non valide");
  }

  const keepPostazione = Boolean(user.postazioneFissa && user.postazioneId);
  let postazioneIdDopoLogin: string | null = user.postazioneId;

  if (keepPostazione) {
    const postazione = await prisma.postazione.findFirst({
      where: { id: user.postazioneId!, tenantId: tenant.id, active: true },
    });
    if (!postazione) {
      postazioneIdDopoLogin = null;
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date(), postazioneId: null, postazioneFissa: false },
      });
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });
    }
  } else {
    postazioneIdDopoLogin = null;
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), postazioneId: null },
    });
  }

  const session: SessionUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as Role,
    supervisorId: user.supervisorId,
    tenantId: user.tenantId,
    tenantSlug: tenant.slug,
    tenantNome: tenant.nome,
    formazioneOnly: user.formazioneOnly,
  };

  await writeAudit({
    userId: user.id,
    tenantId: user.tenantId,
    action: "login",
    entity: "user",
    entityId: user.id,
  });

  if (isPasswordExpired(user.passwordChangedAt)) {
    return { ok: true, href: "/cambia-password", session };
  }

  const needsPostazione = mustChoosePostazioneAlLogin({
    role: user.role as Role,
    formazioneOnly: user.formazioneOnly,
    postazioneId: postazioneIdDopoLogin,
    postazioneFissa: keepPostazione && Boolean(postazioneIdDopoLogin),
  });
  if (user.formazioneOnly) {
    return { ok: true, href: "/formazione/progressi", session };
  }

  const { needsSediSetup } = await import("@/lib/sediSetup");
  if (
    await needsSediSetup({
      role: user.role as Role,
      tenantId: user.tenantId,
    })
  ) {
    return { ok: true, href: "/setup-sedi", session };
  }

  return {
    ok: true,
    href: needsPostazione ? "/seleziona-postazione" : "/",
    session,
  };
}

export function mapLoginException(e: unknown): LoginFailure {
  console.error("[login] errore server", e);
  const message = e instanceof Error ? e.message : "Errore di connessione al server";
  if (message.includes("FIREBASE_SERVICE_ACCOUNT_JSON")) {
    return loginError("Configurazione Firebase non valida su Netlify");
  }
  if (message.includes("Credenziali Firebase Admin mancanti")) {
    return loginError("Firebase non configurato sul server");
  }
  return loginError(message);
}
