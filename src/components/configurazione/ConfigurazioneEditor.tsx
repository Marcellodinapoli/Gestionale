"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Database, Phone, Radio, CheckCircle, ShieldOff } from "lucide-react";
import { salvaConfigurazioneAction } from "@/actions/configurazione";

type Props = {
  config: Record<string, string>;
  secretsPurged?: number;
};

const SEZIONI = [
  {
    id: "database",
    titolo: "Database aziendale",
    icon: Database,
    descrizione:
      "Solo riferimenti operativi. Credenziali VPN/DB sul client VPN e sul server, non qui.",
    doveCredenziali:
      "Password e utente DB/VPN: client VPN sul PC, variabili ambiente del server o vault IT — mai nel gestionale.",
    campi: [
      { chiave: "db_vpn_tipo", label: "Tipo VPN", placeholder: "OpenVPN, WireGuard, IPsec, FortiClient…" },
      { chiave: "db_vpn_host", label: "Server VPN / Host", placeholder: "vpn.azienda.local o 203.0.113.10" },
      { chiave: "db_vpn_porta", label: "Porta VPN", placeholder: "1194, 443, 51820…" },
      {
        chiave: "db_vpn_note",
        label: "Istruzioni VPN (senza password)",
        placeholder: "Es. profilo FortiClient “Azienda”, connettersi prima di lavorare",
      },
      { chiave: "db_tipo", label: "Tipo database", placeholder: "SQL Server, MySQL, PostgreSQL, Oracle…" },
      { chiave: "db_host", label: "Host / IP", placeholder: "192.168.1.100 o db.azienda.local" },
      { chiave: "db_porta", label: "Porta", placeholder: "1433, 3306, 5432…" },
      { chiave: "db_nome", label: "Nome database", placeholder: "gestionale_prod" },
      { chiave: "db_schema", label: "Schema (opzionale)", placeholder: "dbo, public…" },
      { chiave: "db_ssl", label: "Connessione SSL", placeholder: "true / false" },
      { chiave: "db_note", label: "Note", placeholder: "Dettagli non sensibili sulla connessione" },
    ],
  },
  {
    id: "voip",
    titolo: "Centralino VoIP (CounterPath / SIP)",
    icon: Phone,
    descrizione:
      "Parametri click-to-call e PBX. Account SIP solo sul softphone CounterPath della postazione.",
    doveCredenziali:
      "Utente/password SIP: CounterPath (Bria) sul PC operatore. VPN: client VPN aziendale. Qui solo dominio, host e protocollo.",
    campi: [
      {
        chiave: "voip_provider",
        label: "Tipo centralino / softphone",
        placeholder: "",
        options: [
          { value: "counterpath", label: "CounterPath (Bria / softphone SIP)" },
          { value: "default-tel", label: "Telefono di sistema (tel:)" },
          { value: "altro", label: "Altro PBX (configurazione manuale)" },
        ],
      },
      {
        chiave: "voip_softphone_protocol",
        label: "Protocollo click-to-call",
        placeholder: "",
        options: [
          { value: "callto", label: "callto: (CounterPath / Bria, consigliato)" },
          { value: "sip", label: "sip:numero@dominio" },
          { value: "c2c", label: "c2c: (alcuni client CounterPath)" },
          { value: "tel", label: "tel: (sistema operativo)" },
        ],
      },
      {
        chiave: "voip_sip_domain",
        label: "Dominio SIP / Realm",
        placeholder: "pbx.azienda.local o sip.azienda.lan",
      },
      {
        chiave: "voip_host",
        label: "Host / IP PBX (via VPN)",
        placeholder: "192.168.10.50 o pbx.azienda.local",
      },
      {
        chiave: "voip_porta",
        label: "Porta SIP",
        placeholder: "5060",
      },
      {
        chiave: "voip_proxy",
        label: "Outbound proxy (opzionale)",
        placeholder: "proxy.azienda.local:5060",
      },
      {
        chiave: "voip_vpn_obbligatoria",
        label: "VPN obbligatoria per chiamare",
        placeholder: "",
        options: [
          { value: "true", label: "Sì — operatori devono essere in VPN" },
          { value: "false", label: "No" },
        ],
      },
      {
        chiave: "voip_vpn_tipo",
        label: "Tipo VPN telefonia",
        placeholder: "OpenVPN, WireGuard, FortiClient, IPsec…",
      },
      {
        chiave: "voip_vpn_host",
        label: "Server VPN telefonia",
        placeholder: "vpn.azienda.local (se diverso dal DB)",
      },
      {
        chiave: "voip_vpn_note",
        label: "Istruzioni VPN per operatori",
        placeholder: "Connettersi alla VPN aziendale prima di aprire CounterPath",
      },
      {
        chiave: "voip_caller_id",
        label: "Caller ID di default",
        placeholder: "+39 06 1234567",
      },
      {
        chiave: "voip_recording_mode",
        label: "Modalita registrazione",
        placeholder: "",
        options: [
          { value: "continuous", label: "Continua (sempre abilitata)" },
          { value: "manual", label: "Manuale (operatore la conferma)" },
        ],
      },
      {
        chiave: "voip_note",
        label: "Note admin (senza password)",
        placeholder: "Es. codec, firewall, naming postazioni — mai account SIP",
      },
    ],
  },
  {
    id: "dialer",
    titolo: "Dialer",
    icon: Radio,
    descrizione:
      "Riferimenti operativi campagne. Credenziali API solo su server/vault, non nel gestionale.",
    doveCredenziali:
      "Utente/password/API key dialer: variabili ambiente o secret manager sul server di integrazione.",
    campi: [
      { chiave: "dialer_tipo", label: "Tipo dialer", placeholder: "Predictive, Progressive, Preview, Power…" },
      { chiave: "dialer_provider", label: "Provider / Software", placeholder: "VICIdial, GoAutoDial, custom…" },
      { chiave: "dialer_host", label: "Host / IP", placeholder: "192.168.1.60 o dialer.azienda.local" },
      { chiave: "dialer_porta", label: "Porta", placeholder: "8080, 443…" },
      { chiave: "dialer_campagna_default", label: "Campagna di default", placeholder: "RECUPERO_CREDITI" },
      { chiave: "dialer_max_linee", label: "Max linee simultanee", placeholder: "10" },
      { chiave: "dialer_ratio", label: "Ratio chiamate/operatore", placeholder: "1.5" },
      { chiave: "dialer_note", label: "Note", placeholder: "Dettagli non sensibili sul dialer" },
    ],
  },
] as const;

export function ConfigurazioneEditor({ config, secretsPurged = 0 }: Props) {
  return (
    <div className="space-y-6">
      <div className="flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
        <ShieldOff className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
        <div>
          <p className="font-semibold">Nessuna chiave o password nel gestionale</p>
          <p className="mt-0.5 text-xs text-emerald-900/80">
            Password VPN/DB/SIP, file .ovpn e API key non sono accettate e, se presenti da
            configurazioni vecchie, vengono eliminate. Credenziali solo su client VPN,
            softphone CounterPath e vault/server IT.
          </p>
          {secretsPurged > 0 ? (
            <p className="mt-1 text-xs font-semibold text-emerald-800">
              Rimossi ora {secretsPurged} parametri secret dal database di questa azienda.
            </p>
          ) : null}
        </div>
      </div>
      {SEZIONI.map((sezione) => (
        <SezioneConfig key={sezione.id} sezione={sezione} config={config} />
      ))}
    </div>
  );
}

function SezioneConfig({
  sezione,
  config,
}: {
  sezione: (typeof SEZIONI)[number];
  config: Record<string, string>;
}) {
  const router = useRouter();
  const Icon = sezione.icon;
  const [values, setValues] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {};
    for (const c of sezione.campi) {
      v[c.chiave] = config[c.chiave] || "";
    }
    if (sezione.id === "voip") {
      if (!v.voip_provider) v.voip_provider = "counterpath";
      if (!v.voip_softphone_protocol) v.voip_softphone_protocol = "callto";
      if (!v.voip_vpn_obbligatoria) v.voip_vpn_obbligatoria = "true";
      if (!v.voip_recording_mode) v.voip_recording_mode = "manual";
    }
    return v;
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const hasValues = sezione.campi.some((c) => config[c.chiave]);

  async function salva() {
    setSaving(true);
    setMsg(null);
    try {
      const entries = sezione.campi
        .map((c) => ({ chiave: c.chiave, valore: values[c.chiave]?.trim() || "" }))
        .filter((e) => e.valore !== "" || Boolean(config[e.chiave]));
      const fd = new FormData();
      fd.set("categoria", sezione.id);
      fd.set("entries", JSON.stringify(entries));
      await salvaConfigurazioneAction(fd);
      setMsg("Salvato");
      router.refresh();
      setTimeout(() => setMsg(null), 3000);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Errore");
    } finally {
      setSaving(false);
    }
  }

  const inputCls = "h-9 w-full rounded border border-[var(--line)] px-2 text-sm";

  return (
    <div className="rounded-xl border border-[var(--line)] bg-white overflow-hidden">
      <div className="flex items-center gap-3 bg-[#c5d4e3] px-4 py-2.5">
        <Icon className="h-5 w-5 text-[#1a365d]" />
        <div>
          <h2 className="text-sm font-bold text-[#1a365d]">{sezione.titolo}</h2>
          <p className="text-[10px] text-[#1a365d]/70">{sezione.descrizione}</p>
        </div>
        {hasValues && (
          <span className="ml-auto flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
            <CheckCircle className="h-3 w-3" /> Configurato
          </span>
        )}
      </div>
      <p className="border-b border-[var(--line)] bg-[#f8fafc] px-4 py-2 text-[11px] text-[var(--muted)]">
        {sezione.doveCredenziali}
      </p>
      <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
        {sezione.campi.map((campo) => (
          <label key={campo.chiave} className="block text-sm">
            <span className="mb-1 block text-[10px] font-semibold uppercase text-[var(--muted)]">
              {campo.label}
            </span>
            {"options" in campo ? (
              <select
                value={values[campo.chiave]}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, [campo.chiave]: e.target.value }))
                }
                className={inputCls}
              >
                <option value="">Seleziona...</option>
                {campo.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={values[campo.chiave]}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, [campo.chiave]: e.target.value }))
                }
                placeholder={campo.placeholder}
                className={inputCls}
              />
            )}
          </label>
        ))}
      </div>
      <div className="flex items-center gap-3 border-t border-[var(--line)] px-4 py-3">
        <button
          onClick={salva}
          disabled={saving}
          className="h-9 rounded-lg bg-[var(--navy)] px-5 text-sm font-semibold text-white disabled:opacity-50 hover:opacity-90"
        >
          {saving ? "Salvataggio..." : "Salva configurazione"}
        </button>
        {msg && (
          <span
            className={`text-xs font-semibold ${
              msg === "Salvato" ? "text-emerald-600" : "text-amber-600"
            }`}
          >
            {msg}
          </span>
        )}
      </div>
    </div>
  );
}
