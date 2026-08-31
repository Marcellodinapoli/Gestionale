-- Verifica schema CredixaDev
SELECT COUNT(*) AS TableCount FROM sys.tables WHERE schema_id = SCHEMA_ID('dbo');
SELECT COUNT(*) AS ForeignKeyCount FROM sys.foreign_keys;
SELECT COUNT(*) AS IndexCount FROM sys.indexes WHERE object_id IN (SELECT object_id FROM sys.tables WHERE schema_id = SCHEMA_ID('dbo')) AND index_id > 0;

SELECT t.name AS TableName
FROM sys.tables t
WHERE t.schema_id = SCHEMA_ID('dbo')
ORDER BY t.name;
