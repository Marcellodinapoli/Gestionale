-- Fase giudiziale: estensione 1:1 della pratica
IF OBJECT_ID('dbo.PraticheGiudiziali', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.PraticheGiudiziali (
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_PraticheGiudiziali PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    TenantId UNIQUEIDENTIFIER NOT NULL,
    PraticaId UNIQUEIDENTIFIER NOT NULL,
    StatoAvvio NVARCHAR(80) NOT NULL CONSTRAINT DF_PraticheGiudiziali_StatoAvvio DEFAULT N'BOZZA',
    DataAffidamentoGiudiziale DATETIME2(3) NULL,
    StudioLegale NVARCHAR(200) NULL,
    AvvocatoReferente NVARCHAR(200) NULL,
    ReferenteInternoId UNIQUEIDENTIFIER NULL,
    NoteAffidamento NVARCHAR(MAX) NULL,
    MotivoPassaggio NVARCHAR(80) NULL,
    MotivoAltroDettaglio NVARCHAR(500) NULL,
    DocumentazioneDisponibile NVARCHAR(30) NULL,
    PrescrizioneVerificata NVARCHAR(30) NULL,
    AnagraficaDebitoreVerificata NVARCHAR(30) NULL,
    ValutazioneRecuperabilita NVARCHAR(30) NULL,
    NoteVerifica NVARCHAR(MAX) NULL,
    MotivazioneArchiviazione NVARCHAR(1000) NULL,
    NoteArchiviazione NVARCHAR(MAX) NULL,
    CreatedById UNIQUEIDENTIFIER NULL,
    CreatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_PraticheGiudiziali_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_PraticheGiudiziali_UpdatedAt DEFAULT SYSUTCDATETIME(),
    ClosedAt DATETIME2(3) NULL,
    CONSTRAINT UQ_PraticheGiudiziali_Pratica UNIQUE (PraticaId),
    CONSTRAINT FK_PraticheGiudiziali_Tenant FOREIGN KEY (TenantId) REFERENCES dbo.Tenants(Id),
    CONSTRAINT FK_PraticheGiudiziali_Pratica FOREIGN KEY (PraticaId) REFERENCES dbo.Pratiche(Id) ON DELETE CASCADE,
    CONSTRAINT FK_PraticheGiudiziali_Referente FOREIGN KEY (ReferenteInternoId) REFERENCES dbo.Users(Id)
  );
  CREATE INDEX IX_PraticheGiudiziali_Tenant ON dbo.PraticheGiudiziali (TenantId);
  CREATE INDEX IX_PraticheGiudiziali_StatoAvvio ON dbo.PraticheGiudiziali (StatoAvvio);
END
GO
