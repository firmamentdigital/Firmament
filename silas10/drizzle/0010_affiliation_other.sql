ALTER TABLE `children` ADD `affiliation_other` text;--> statement-breakpoint
-- Vínculo "Outro": aceito no banco, sempre com o texto de qual é o vínculo.
DROP TRIGGER IF EXISTS child_affiliation_insert;
--> statement-breakpoint
CREATE TRIGGER child_affiliation_insert
BEFORE INSERT ON children
WHEN NEW.affiliation IS NULL OR NEW.affiliation NOT IN ('cod', 'athletics', 'other')
  OR (NEW.affiliation = 'other' AND length(trim(coalesce(NEW.affiliation_other, ''))) = 0)
BEGIN
  SELECT RAISE(ABORT, 'child_affiliation_required');
END;
--> statement-breakpoint
DROP TRIGGER IF EXISTS child_affiliation_update;
--> statement-breakpoint
CREATE TRIGGER child_affiliation_update
BEFORE UPDATE OF affiliation, affiliation_other ON children
WHEN NEW.affiliation IS NULL OR NEW.affiliation NOT IN ('cod', 'athletics', 'other')
  OR (NEW.affiliation = 'other' AND length(trim(coalesce(NEW.affiliation_other, ''))) = 0)
BEGIN
  SELECT RAISE(ABORT, 'child_affiliation_required');
END;
