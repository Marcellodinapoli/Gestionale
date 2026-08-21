/** Chiavi che non devono mai essere persistite nel gestionale. */
export const SECRET_CONFIG_KEYS = [
  "db_vpn_utente",
  "db_vpn_password",
  "db_vpn_config",
  "db_utente",
  "db_password",
  "voip_utente",
  "voip_password",
  "voip_api_key",
  "voip_api_url",
  "dialer_api_user",
  "dialer_api_password",
  "dialer_api_key",
] as const;

export type SecretConfigKey = (typeof SECRET_CONFIG_KEYS)[number];

export function isSecretConfigKey(chiave: string): boolean {
  return (SECRET_CONFIG_KEYS as readonly string[]).includes(chiave);
}
