-- CredixaDev — creazione database e login applicativo (eseguire come sa dopo installazione)
-- Istanza: CREDIXA_DEV, porta 1433

IF NOT EXISTS (SELECT 1 FROM sys.databases WHERE name = N'CredixaDev')
BEGIN
  CREATE DATABASE CredixaDev;
END
GO

USE CredixaDev;
GO

IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = N'credixa_dev')
BEGIN
  CREATE LOGIN credixa_dev WITH PASSWORD = N'ChangeMe_CredixaDev!', CHECK_POLICY = OFF;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'credixa_dev')
BEGIN
  CREATE USER credixa_dev FOR LOGIN credixa_dev;
  ALTER ROLE db_owner ADD MEMBER credixa_dev;
END
GO
