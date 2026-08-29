"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";
import { mustChoosePostazioneAlLogin, type Role } from "@/lib/permissions";
import { isPasswordExpired } from "@/lib/passwordPolicy";
import { normalizeTenantSlug } from "@/lib/tenant";
import { writeAudit } from "@/lib/domain";

export async function loginAction(input: {
  email?: string;
  password?: string;
  tenantSlug?: string;
}): Promise<{ error: string } | { ok: true; href: string }> {
  try {
    const email = String(input?.email || "")
      .trim()
      .toLowerCase();
    const password = String(input?.password || "");
    const slug = normalizeTenantSlug(String(input?.tenantSlug || ""));
    if (!slug) return { error: "Inserisci il codice azienda" };
    if (!email) return { error: "Inserisci l'email" };
    if (!password) return { error: "Inserisci la password" };

    const tenant = await prisma.tenant.findUnique({ where: { slug } });
    if (!tenant || tenant.active === false) {
      return { error: "Azienda non trovata o non attiva" };
    }

    const user = await prisma.user.findUnique({
      where: { tenantId_email: { tenantId: tenant.id, email } },
    });
    if (!user) {
      console.error("[login] utente assente", { slug, email, tenantId: tenant.id });
      return { error: "Credenziali non valide" };
    }
    if (user.active === false) {
      console.error("[login] utente disattivo", { email });
      return { error: "Credenziali non valide" };
    }
    const hash = String(user.passwordHash || "");
    const ok = hash ? await bcrypt.compare(password, hash) : false;
    if (!ok) {
      console.error("[login] password non valida", {
        email,
        hashLen: hash.length,
        passwordLen: password.length,
      });
      return { error: "Credenziali non valide" };
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

    await Promise.all([
      createSession({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role as Role,
        supervisorId: user.supervisorId,
        tenantId: user.tenantId,
        tenantSlug: tenant.slug,
        tenantNome: tenant.nome,
        formazioneOnly: user.formazioneOnly,
      }),
      writeAudit({
        userId: user.id,
        tenantId: user.tenantId,
        action: "login",
        entity: "user",
        entityId: user.id,
      }),
    ]);

    if (isPasswordExpired(user.passwordChangedAt)) {
      return { ok: true, href: "/cambia-password" };
    }

    const needsPostazione = mustChoosePostazioneAlLogin({
      role: user.role as Role,
      formazioneOnly: user.formazioneOnly,
      postazioneId: postazioneIdDopoLogin,
      postazioneFissa: keepPostazione && Boolean(postazioneIdDopoLogin),
    });
    if (user.formazioneOnly) {
      return { ok: true, href: "/formazione/progressi" };
    }
    const { needsSediSetup } = await import("@/lib/sediSetup");
    if (
      await needsSediSetup({
        role: user.role as Role,
        tenantId: user.tenantId,
      })
    ) {
      return { ok: true, href: "/setup-sedi" };
    }
    return { ok: true, href: needsPostazione ? "/seleziona-postazione" : "/" };
  } catch (e) {
    console.error("[login] errore server", e);
    const message =
      e instanceof Error ? e.message : "Errore di connessione al server";
    if (message.includes("FIREBASE_SERVICE_ACCOUNT_JSON")) {
      return { error: "Configurazione Firebase non valida su Netlify" };
    }
    if (message.includes("Credenziali Firebase Admin mancanti")) {
      return { error: "Firebase non configurato sul server" };
    }
    return { error: message };
  }
}
