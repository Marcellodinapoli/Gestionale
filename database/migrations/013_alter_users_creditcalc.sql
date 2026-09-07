-- Consulente esterno + abilitazione CreditCalc (solo Admin/Amministrazione dalla scheda operatore)
IF COL_LENGTH('dbo.Users', 'ConsulenteEsterno') IS NULL
  ALTER TABLE dbo.Users ADD ConsulenteEsterno BIT NOT NULL
    CONSTRAINT DF_Users_ConsulenteEsterno DEFAULT 0;
GO

IF COL_LENGTH('dbo.Users', 'CreditCalcEnabled') IS NULL
  ALTER TABLE dbo.Users ADD CreditCalcEnabled BIT NOT NULL
    CONSTRAINT DF_Users_CreditCalcEnabled DEFAULT 0;
GO
