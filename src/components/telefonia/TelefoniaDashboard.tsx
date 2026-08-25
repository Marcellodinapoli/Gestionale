"use client";

import Link from "next/link";
import {
  Phone,
  PhoneIncoming,
  PhoneOff,
  Headphones,
  MessageSquare,
  ArrowRightLeft,
  Pause,
  Eye,
  Mic,
  Radio,
  Users,
  CheckCircle2,
  XCircle,
  Shield,
  Settings,
} from "lucide-react";
import type { TelephonyCapabilities } from "@/lib/telephony/types";
import type { TenantTelephonyConfig } from "@/lib/telephony/clientConfig";

function CapRow({
  label,
  icon: Icon,
  active,
  description,
}: {
  label: string;
  icon: React.ElementType;
  active: boolean;
  description: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded border border-[var(--line)] bg-white px-3 py-2">
      <Icon className="h-4 w-4 shrink-0 text-[var(--navy)]" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-[var(--navy)]">{label}</p>
        <p className="text-[10px] text-[var(--muted)]">{description}</p>
      </div>
      {active ? (
        <span className="flex items-center gap-1 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
          <CheckCircle2 className="h-3 w-3" /> Attivo
        </span>
      ) : (
        <span className="flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
          <XCircle className="h-3 w-3" /> Non disponibile
        </span>
      )}
    </div>
  );
}

const CAP_MAP: {
  key: keyof TelephonyCapabilities;
  label: string;
  icon: React.ElementType;
  description: string;
}[] = [
  { key: "canDial", label: "Chiamata in uscita", icon: Phone, description: "Click-to-call verso softphone CounterPath" },
  { key: "canReceive", label: "Chiamata in entrata", icon: PhoneIncoming, description: "Gestita dal softphone registrato al PBX" },
  { key: "canRecord", label: "Registrazione", icon: Mic, description: "Registrazione lato PBX / conferma in pratica" },
  { key: "canHold", label: "Attesa", icon: Pause, description: "Funzione del softphone / centralino" },
  { key: "canTransfer", label: "Trasferimento", icon: ArrowRightLeft, description: "Funzione del softphone / centralino" },
  { key: "canListenLive", label: "Ascolto live", icon: Headphones, description: "Richiede integrazione AMI/API avanzata" },
  { key: "canWhisper", label: "Whisper", icon: MessageSquare, description: "Richiede integrazione AMI/API avanzata" },
  { key: "canBarge", label: "Barge-in", icon: Radio, description: "Richiede integrazione AMI/API avanzata" },
  { key: "canGetPresence", label: "Stato presenza", icon: Users, description: "Richiede integrazione AMI/API avanzata" },
];

function providerLabel(name: string | null) {
  if (name === "counterpath-softphone") return "CounterPath Softphone (SIP)";
  if (name === "default-tel") return "Telefono di sistema (tel:)";
  return name ?? "Nessuno";
}

export function TelefoniaDashboard({
  providerAttivo,
  providerCapabilities,
  providerDisponibili,
  tenantConfig,
}: {
  providerAttivo: string | null;
  providerCapabilities: TelephonyCapabilities | null;
  providerDisponibili: string[];
  tenantConfig: TenantTelephonyConfig;
}) {
  const sectionCls =
    "rounded-lg border border-[var(--line)] bg-[#f8fafc] overflow-hidden";
  const headerCls =
    "bg-[#c5d4e3] px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-[#1a365d]";

  return (
    <div className="mx-auto max-w-3xl space-y-4 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <Phone className="h-5 w-5 text-[var(--navy)]" />
        <h1 className="text-lg font-bold text-[var(--navy)]">
          Gestione Telefonia
        </h1>
        <Link
          href="/configurazione"
          className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--line)] bg-white px-3 text-xs font-semibold text-[var(--navy)] hover:bg-[#eef4f8]"
        >
          <Settings className="h-3.5 w-3.5" />
          Configura (admin)
        </Link>
      </div>

      <div className={sectionCls}>
        <div className={headerCls}>Profilo azienda (admin)</div>
        <div className="space-y-3 p-3 text-xs text-[var(--navy)]">
          {!tenantConfig.configured ? (
            <p className="text-[var(--muted)]">
              Nessuna configurazione VoIP salvata. L&apos;amministratore deve
              impostare CounterPath e VPN in{" "}
              <Link href="/configurazione" className="font-semibold underline">
                Configurazione sistema
              </Link>
              .
            </p>
          ) : (
            <dl className="grid gap-2 sm:grid-cols-2">
              <div>
                <dt className="text-[10px] font-semibold uppercase text-[var(--muted)]">
                  Softphone
                </dt>
                <dd className="font-semibold">
                  {tenantConfig.provider === "counterpath"
                    ? "CounterPath (Bria / SIP)"
                    : tenantConfig.provider === "default-tel"
                      ? "tel: di sistema"
                      : "Altro PBX"}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase text-[var(--muted)]">
                  Click-to-call
                </dt>
                <dd className="font-mono font-semibold">
                  {tenantConfig.softphoneProtocol}:
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase text-[var(--muted)]">
                  Dominio SIP
                </dt>
                <dd>{tenantConfig.sipDomain || "—"}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase text-[var(--muted)]">
                  Host PBX
                </dt>
                <dd>
                  {tenantConfig.pbxHost || "—"}
                  {tenantConfig.pbxPort ? `:${tenantConfig.pbxPort}` : ""}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="flex items-center gap-1 text-[10px] font-semibold uppercase text-[var(--muted)]">
                  <Shield className="h-3 w-3" /> VPN
                </dt>
                <dd>
                  {tenantConfig.vpnObbligatoria
                    ? "Obbligatoria per chiamare"
                    : "Non obbligatoria"}
                  {tenantConfig.vpnTipo ? ` · ${tenantConfig.vpnTipo}` : ""}
                  {tenantConfig.vpnHost ? ` · ${tenantConfig.vpnHost}` : ""}
                </dd>
                {tenantConfig.vpnNote ? (
                  <p className="mt-1 text-[10px] text-[var(--muted)]">
                    {tenantConfig.vpnNote}
                  </p>
                ) : null}
              </div>
            </dl>
          )}
          <p className="rounded border border-[var(--line)] bg-white p-2 text-[10px] text-[var(--muted)]">
            Flusso: operatore in VPN → softphone CounterPath registrato al PBX →
            dal gestionale click sul numero → protocollo OS apre CounterPath e
            compone. Account SIP e password VPN non sono nel gestionale: solo sul
            PC (CounterPath + client VPN).
          </p>
        </div>
      </div>

      <div className={sectionCls}>
        <div className={headerCls}>Provider attivo</div>
        <div className="p-3">
          {providerAttivo ? (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-800">
                <CheckCircle2 className="h-4 w-4" />
                {providerLabel(providerAttivo)}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <PhoneOff className="h-4 w-4 text-[var(--muted)]" />
              <p className="text-sm font-semibold text-[var(--navy)]">
                Nessun provider attivo
              </p>
            </div>
          )}
        </div>
      </div>

      <div className={sectionCls}>
        <div className={headerCls}>Provider disponibili</div>
        <div className="p-3">
          {providerDisponibili.length > 0 ? (
            <ul className="space-y-1">
              {providerDisponibili.map((name) => (
                <li
                  key={name}
                  className="flex items-center gap-2 rounded border border-[var(--line)] bg-white px-3 py-1.5 text-xs"
                >
                  <Eye className="h-3.5 w-3.5 text-[var(--muted)]" />
                  <span className="font-semibold">{providerLabel(name)}</span>
                  {name === providerAttivo ? (
                    <span className="ml-auto rounded bg-emerald-100 px-1.5 py-px text-[10px] font-semibold text-emerald-700">
                      In uso
                    </span>
                  ) : (
                    <span className="ml-auto rounded bg-slate-100 px-1.5 py-px text-[10px] text-slate-500">
                      Registrato
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-[var(--muted)]">
              Nessun provider registrato.
            </p>
          )}
        </div>
      </div>

      <div className={sectionCls}>
        <div className={headerCls}>Funzionalita telefonia</div>
        <div className="space-y-1 p-3">
          <p className="mb-2 text-[10px] text-[var(--muted)]">
            Con CounterPath il gestionale gestisce il click-to-call; hold,
            transfer e registrazione audio avanzata restano sul softphone/PBX
            finché non si collega un&apos;API AMI.
          </p>
          {CAP_MAP.map((c) => (
            <CapRow
              key={c.key}
              label={c.label}
              icon={c.icon}
              active={providerCapabilities?.[c.key] ?? false}
              description={c.description}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
