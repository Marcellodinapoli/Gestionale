import type { TelephonyProvider } from "./types";

/**
 * Registro singleton dei provider di telefonia.
 *
 * Uso futuro:
 *   TelephonyRegistry.register("3cx", new ThreeCxProvider());
 *   TelephonyRegistry.setActive("3cx");
 *   const provider = TelephonyRegistry.active();
 */
class Registry {
  private providers = new Map<string, TelephonyProvider>();
  private activeKey: string | null = null;

  register(key: string, provider: TelephonyProvider) {
    this.providers.set(key, provider);
  }

  unregister(key: string) {
    if (this.activeKey === key) this.activeKey = null;
    this.providers.delete(key);
  }

  setActive(key: string) {
    if (!this.providers.has(key)) {
      throw new Error(`Telephony provider "${key}" non registrato`);
    }
    this.activeKey = key;
  }

  active(): TelephonyProvider | null {
    if (!this.activeKey) return null;
    return this.providers.get(this.activeKey) ?? null;
  }

  list(): string[] {
    return [...this.providers.keys()];
  }

  get(key: string): TelephonyProvider | undefined {
    return this.providers.get(key);
  }
}

export const TelephonyRegistry = new Registry();
