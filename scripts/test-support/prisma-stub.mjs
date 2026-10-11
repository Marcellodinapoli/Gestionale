// I test girano con DATABASE_PROVIDER=neon: Prisma non deve mai essere usato.
export const prisma = new Proxy({}, { get() { throw new Error("prisma non disponibile nei test"); } });
export default prisma;
