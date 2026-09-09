-- Campi archiviazione giudiziale + allarga StatoAvvio
IF COL_LENGTH('dbo.PraticheGiudiziali', 'MotivazioneArchiviazione') IS NULL
BEGIN
  ALTER TABLE dbo.PraticheGiudiziali ADD MotivazioneArchiviazione NVARCHAR(1000) NULL;
END
GO
IF COL_LENGTH('dbo.PraticheGiudiziali', 'NoteArchiviazione') IS NULL
BEGIN
  ALTER TABLE dbo.PraticheGiudiziali ADD NoteArchiviazione NVARCHAR(MAX) NULL;
END
GO
IF COL_LENGTH('dbo.PraticheGiudiziali', 'StatoAvvio') IS NOT NULL
BEGIN
  ALTER TABLE dbo.PraticheGiudiziali ALTER COLUMN StatoAvvio NVARCHAR(80) NOT NULL;
END
GO
