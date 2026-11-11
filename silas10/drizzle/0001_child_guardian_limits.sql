DROP TRIGGER family_guardian_limit;
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
