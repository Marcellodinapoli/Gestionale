import { getDatabaseProvider } from "./config";
import { createConnectorRepositories } from "./connector/ConnectorRepository";
import { createNeonRepositories } from "@/lib/neon/NeonRepository";
import type {
  DashboardRepository,
  DataRepositories,
  PostazioniRepository,
  PraticheRepository,
  TenantsRepository,
  UsersRepository,
} from "./contracts/repositories";

let connectorRepos: DataRepositories | null = null;
let neonRepos: DataRepositories | null = null;

function repos(): DataRepositories {
  const provider = getDatabaseProvider();
  if (provider === "neon") {
    if (!neonRepos) neonRepos = createNeonRepositories();
    return neonRepos;
  }
  if (provider === "connector") {
    if (!connectorRepos) connectorRepos = createConnectorRepositories();
    return connectorRepos;
  }
  throw new Error(`DATABASE_PROVIDER '${provider}' non espone repository SQL`);
}

export function getDataRepositories(): DataRepositories | null {
  const provider = getDatabaseProvider();
  if (provider !== "connector" && provider !== "neon") return null;
  return repos();
}

export function getTenantsRepository(): TenantsRepository {
  return repos().tenants;
}

export function getUsersRepository(): UsersRepository {
  return repos().users;
}

export function getPostazioniRepository(): PostazioniRepository {
  return repos().postazioni;
}

export function getPraticheRepository(): PraticheRepository {
  return repos().pratiche;
}

export function getDashboardRepository(): DashboardRepository {
  return repos().dashboard;
}

export function isConnectorProvider(): boolean {
  return getDatabaseProvider() === "connector";
}

export function isNeonProvider(): boolean {
  return getDatabaseProvider() === "neon";
}

/** Auth/sessione e repo tipizzati su SQL (Connettore o Neon). */
export function isSqlBackendProvider(): boolean {
  return isConnectorProvider() || isNeonProvider();
}

export function describeDatabaseProvider() {
  const provider = getDatabaseProvider();
  return {
    provider,
    wiredToApp: provider === "connector" || provider === "neon",
    note:
      provider === "neon"
        ? "Auth e dati operativi su Neon Postgres; Formazione resta su Firebase"
        : provider === "connector"
          ? "Auth/login e sessione usano il Connettore; altri moduli in migrazione graduale"
          : "App usa prisma/firebase (default)",
  } as const;
}
