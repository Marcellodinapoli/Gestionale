export type PostazioneFilter = {
  tenantId?: string;
  id?: string;
  idsIn?: string[];
  nome?: string;
  active?: boolean;
  sedeId?: string;
  excludeId?: string;
};

export type PostazioneDto = {
  id: string;
  tenantId: string;
  sedeId: string | null;
  nome: string;
  interno: string | null;
  email: string | null;
  numeroFisso: string | null;
  note: string | null;
  active: boolean;
  createdAt: string | Date;
  sedeRef?: { id: string; nome: string } | null;
  occupanti?: Array<{ id: string; name: string }>;
};

export type PostazioneCreateInput = {
  tenantId: string;
  nome: string;
  sedeId?: string | null;
  interno?: string | null;
  email?: string | null;
  numeroFisso?: string | null;
  note?: string | null;
  active?: boolean;
};

export type PostazioneUpdateInput = Partial<Omit<PostazioneCreateInput, "tenantId">>;

export type PostazioneListOptions = PostazioneFilter & {
  orderBy?: "nome" | "createdAt" | "sedeNome";
  orderDir?: "asc" | "desc";
  take?: number;
  includeSede?: boolean;
  includeOccupants?: boolean;
  excludeOccupantUserId?: string;
};

export interface PostazioniRepository {
  list(
    tenantSlug: string,
    tenantId: string,
    filter?: PostazioneListOptions
  ): Promise<PostazioneDto[]>;
  count(tenantSlug: string, tenantId: string, filter?: PostazioneFilter): Promise<number>;
  getById(tenantSlug: string, tenantId: string, id: string): Promise<PostazioneDto | null>;
  findByNome(
    tenantSlug: string,
    tenantId: string,
    nome: string,
    excludeId?: string
  ): Promise<PostazioneDto | null>;
  create(tenantSlug: string, data: PostazioneCreateInput): Promise<PostazioneDto>;
  update(
    tenantSlug: string,
    tenantId: string,
    id: string,
    data: PostazioneUpdateInput
  ): Promise<PostazioneDto>;
  delete(tenantSlug: string, tenantId: string, id: string): Promise<void>;
}
