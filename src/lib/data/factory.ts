import { getDatabaseProvider } from "./config";

import { createConnectorRepositories } from "./connector/ConnectorRepository";

import type {

  DashboardRepository,

  DataRepositories,

  PostazioniRepository,

  PraticheRepository,

  TenantsRepository,

  UsersRepository,

} from "./contracts/repositories";



let connectorRepos: DataRepositories | null = null;



function repos(): DataRepositories {

  if (getDatabaseProvider() !== "connector") {

    throw new Error("DATABASE_PROVIDER non è 'connector'");

  }

  if (!connectorRepos) connectorRepos = createConnectorRepositories();

  return connectorRepos;

}



export function getDataRepositories(): DataRepositories | null {

  if (getDatabaseProvider() !== "connector") return null;

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



export function describeDatabaseProvider() {

  const provider = getDatabaseProvider();

  return {

    provider,

    wiredToApp: provider === "connector",

    note:

      provider === "connector"

        ? "Auth/login e sessione usano il Connettore; altri moduli in migrazione graduale"

        : "App usa prisma/firebase (default)",

  } as const;

}


