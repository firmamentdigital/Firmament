import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const guardians = sqliteTable("guardians", {
  id: text("id").primaryKey(),
  fullName: text("full_name").notNull(),
  birthDate: text("birth_date").notNull(),
  createdAt: text("created_at").notNull(),
  checkedInAt: text("checked_in_at"),
  checkedInBy: text("checked_in_by"),
  version: integer("version").notNull().default(0),
});

export const families = sqliteTable("families", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  primaryGuardianId: text("primary_guardian_id").notNull().references(() => guardians.id),
  phone: text("phone").notNull(),
  createdAt: text("created_at").notNull(),
  status: text("status", { enum: ["active", "cancelled"] }).notNull().default("active"),
  version: integer("version").notNull().default(0),
  cancelledAt: text("cancelled_at"),
  cancelledBy: text("cancelled_by"),
});

export const familyGuardians = sqliteTable("family_guardians", {
  familyId: text("family_id").notNull().references(() => families.id),
  guardianId: text("guardian_id").notNull().references(() => guardians.id),
  willAttend: integer("will_attend").notNull().default(1),
  // Celular próprio do segundo responsável. O do responsável principal fica em families.phone.
  phone: text("phone"),
}, table => [primaryKey({ columns: [table.familyId, table.guardianId] })]);

export const children = sqliteTable("children", {
  id: text("id").primaryKey(),
  familyId: text("family_id").notNull().references(() => families.id),
  fullName: text("full_name").notNull(),
  birthDate: text("birth_date").notNull(),
  affiliation: text("affiliation", { enum: ["cod", "athletics"] }),
  createdAt: text("created_at").notNull(),
  checkedInAt: text("checked_in_at"),
  checkedInBy: text("checked_in_by"),
  version: integer("version").notNull().default(0),
});

export const childGuardians = sqliteTable("child_guardians", {
  childId: text("child_id").notNull().references(() => children.id),
  guardianId: text("guardian_id").notNull().references(() => guardians.id),
}, table => [primaryKey({ columns: [table.childId, table.guardianId] })]);

export const submissions = sqliteTable("submissions", {
  id: text("id").primaryKey(),
  familyId: text("family_id").notNull().references(() => families.id),
  payloadHash: text("payload_hash").notNull(),
  question: text("question").notNull().default(""),
  responseJson: text("response_json").notNull(),
  createdAt: text("created_at").notNull(),
});

export const ownerIdentity = sqliteTable("owner_identity", {
  key: text("key").primaryKey(),
  userId: text("user_id").notNull(),
  email: text("email").notNull(),
  boundAt: text("bound_at").notNull(),
});

export const adminMembers = sqliteTable("admin_members", {
  email: text("email").primaryKey(),
  userId: text("user_id").unique(),
  active: integer("active").notNull().default(1),
  createdAt: text("created_at").notNull(),
  createdBy: text("created_by").notNull(),
  activatedAt: text("activated_at"),
  revokedAt: text("revoked_at"),
  version: integer("version").notNull().default(0),
  passwordHash: text("password_hash"),
  passwordVersion: integer("password_version").notNull().default(0),
  passwordChangedAt: text("password_changed_at"),
  inviteHash: text("invite_hash"),
  inviteExpiresAt: integer("invite_expires_at"),
});

export const guestSessions = sqliteTable("guest_sessions", {
  tokenHash: text("token_hash").primaryKey(),
  memberEmail: text("member_email").notNull().references(() => adminMembers.email),
  phase: text("phase", { enum: ["setup", "ready"] }).notNull(),
  credentialVersion: integer("credential_version").notNull(),
  createdAt: integer("created_at").notNull(),
  expiresAt: integer("expires_at").notNull(),
});
export const guestLoginAttempts = sqliteTable("guest_login_attempts", {
  key: text("key").primaryKey(),
  failures: integer("failures").notNull().default(0),
  windowStarted: integer("window_started").notNull(),
});

export const masterSessions = sqliteTable("master_sessions", {
  tokenHash: text("token_hash").primaryKey(),
  credentialFingerprint: text("credential_fingerprint").notNull(),
  createdAt: integer("created_at").notNull(),
  expiresAt: integer("expires_at").notNull(),
}, table => [index("master_sessions_expiry_idx").on(table.expiresAt)]);

export const eventBrands = sqliteTable("event_brands", {
  id: text("id").primaryKey(),
  category: text("category", { enum: ["organizer", "supporter"] }).notNull(),
  label: text("label").notNull(),
  assetKey: text("asset_key"),
  assetPath: text("asset_path"),
  mime: text("mime"),
  sortOrder: integer("sort_order").notNull().default(0),
  active: integer("active").notNull().default(1),
  version: integer("version").notNull().default(0),
  updatedAt: text("updated_at").notNull(),
  updatedBy: text("updated_by").notNull(),
});

export const messageCampaigns = sqliteTable("message_campaigns", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  imageKey: text("image_key"),
  imageName: text("image_name"),
  imageMime: text("image_mime"),
  createdAt: text("created_at").notNull(),
  createdBy: text("created_by").notNull(),
});

export const messageContacts = sqliteTable("message_contacts", {
  campaignId: text("campaign_id").notNull().references(() => messageCampaigns.id),
  phone: text("phone").notNull(),
  detailsJson: text("details_json").notNull(),
  confirmedAt: text("confirmed_at"),
  confirmedBy: text("confirmed_by"),
  version: integer("version").notNull().default(0),
}, table => [primaryKey({ columns: [table.campaignId, table.phone] })]);
