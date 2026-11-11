ALTER TABLE `children` ADD `affiliation` text;
--> statement-breakpoint
DROP TRIGGER child_guardian_limit;
--> statement-breakpoint
CREATE TRIGGER child_guardian_limit
BEFORE INSERT ON child_guardians
WHEN NOT EXISTS (
  SELECT 1 FROM child_guardians
  WHERE child_id = NEW.child_id AND guardian_id = NEW.guardian_id
) AND (SELECT COUNT(*) FROM child_guardians WHERE child_id = NEW.child_id) >= 1
BEGIN
  SELECT RAISE(ABORT, 'child_guardian_limit');
END;
--> statement-breakpoint
CREATE TRIGGER child_affiliation_insert
BEFORE INSERT ON children
WHEN NEW.affiliation IS NULL OR NEW.affiliation NOT IN ('cod', 'athletics')
BEGIN
  SELECT RAISE(ABORT, 'child_affiliation_required');
END;
--> statement-breakpoint
CREATE TRIGGER child_affiliation_update
BEFORE UPDATE OF affiliation ON children
WHEN NEW.affiliation IS NULL OR NEW.affiliation NOT IN ('cod', 'athletics')
BEGIN
  SELECT RAISE(ABORT, 'child_affiliation_required');
END;
