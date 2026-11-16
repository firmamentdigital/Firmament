-- Permite um segundo responsável (ex.: pai e mãe) por criança, quando a família
-- inscreve duas ou mais crianças. A regra de "quando" fica na validação do servidor;
-- aqui o banco garante o teto de 2 responsáveis por criança.
DROP TRIGGER child_guardian_limit;
--> statement-breakpoint
CREATE TRIGGER child_guardian_limit
BEFORE INSERT ON child_guardians
WHEN NOT EXISTS (
  SELECT 1 FROM child_guardians
  WHERE child_id = NEW.child_id AND guardian_id = NEW.guardian_id
) AND (SELECT COUNT(*) FROM child_guardians WHERE child_id = NEW.child_id) >= 2
BEGIN
  SELECT RAISE(ABORT, 'child_guardian_limit');
END;
