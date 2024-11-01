import { pgEnum, pgTable, serial, text, jsonb, timestamp, numeric, boolean, integer } from 'drizzle-orm/pg-core';

// Enums
export const visibilityType = pgEnum('visibility_type', ['public', 'private', 'restricted', 'project']);
export const collaborationType = pgEnum('collaboration_type', ['open', 'closed', 'request']);
export const projectStatus = pgEnum('project_status', ['active', 'inactive', 'completed']);
export const contentType = pgEnum('content_type', ['discussion', 'hypothesis', 'educational', 'patient_story']);
export const roleType = pgEnum('role_type', ['member', 'moderator']);
export const activityType = pgEnum('activity_type', [
  'profile_update', 'project_creation', 'project_update',
  'content_creation', 'content_update', 'comment_creation',
  'comment_update', 'project_join', 'project_leave'
]);
export const curationStatus = pgEnum('curation_status', ['accepted', 'rejected', 'uncertain']);

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  image: text('image'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const profiles = pgTable('profiles', {
  id: integer('id').primaryKey().references(() => users.id),
  username: text('username').unique(),
  bio: text('bio'),
  location: text('location'),
  website: text('website'),
  socialLinks: jsonb('social_links'),
  credentials: jsonb('credentials'),
  organization: text('organization'),
  position: text('position'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  lastActive: timestamp('last_active').defaultNow().notNull(),
  notificationPreferences: jsonb('notification_preferences'),
  deletedAt: timestamp('deleted_at'),
});

export const projects = pgTable('projects', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  disease: text('disease').notNull(),
  description: text('description').notNull(),
  researchGoals: text('research_goals').array(),
  visibility: visibilityType('visibility').notNull(),
  collaboration: collaborationType('collaboration').notNull(),
  progress: numeric('progress', { precision: 5, scale: 2 }),
  status: projectStatus('status').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
  deletedAt: timestamp('deleted_at'),
});

export const statements = pgTable('statements', {
  id: serial('id').primaryKey(),
  type: text('type').notNull(),
  belief: numeric('belief', { precision: 4, scale: 3 }),
  enzName: text('enz_name'),
  subName: text('sub_name'),
  subjName: text('subj_name'),
  objName: text('obj_name'),
  members: text('members').array(),
  objActivity: text('obj_activity'),
  matchesHash: text('matches_hash'),
  position: text('position'),
  residue: text('residue'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
  deletedAt: timestamp('deleted_at'),
});

export const evidence = pgTable('evidence', {
  id: serial('id').primaryKey(),
  statementId: integer('statement_id').notNull().references(() => statements.id, { onDelete: 'cascade' }),
  pmid: text('pmid'),
  sourceApi: text('source_api'),
  sourceHash: text('source_hash'),
  text: text('text'),
  textRefs: jsonb('text_refs'),
  annotations: jsonb('annotations'),
  contextType: text('context_type'),
  contextCellLine: text('context_cell_line'),
  contextLocation: text('context_location'),
  contextOrgan: text('context_organ'),
  contextSpecies: text('context_species'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const projectMembers = pgTable('project_members', {
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: roleType('role').notNull(),
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
});

export const projectPendingApplications = pgTable('project_pending_applications', {
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const curations = pgTable('curations', {
  id: serial('id').primaryKey(),
  statementId: integer('statement_id').notNull().references(() => statements.id, { onDelete: 'restrict' }),
  curatorId: integer('curator_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  projectId: integer('project_id').references(() => projects.id, { onDelete: 'set null' }),
  status: curationStatus('status').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
  deletedAt: timestamp('deleted_at'),
});

export const content = pgTable('content', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  type: contentType('type').notNull(),
  projectId: integer('project_id').references(() => projects.id, { onDelete: 'set null' }),
  authorId: integer('usersor_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  edited: boolean('edited').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
  deletedAt: timestamp('deleted_at'),
});

export const contentModeration = pgTable('content_moderation', {
  id: serial('id').primaryKey(),
  contentId: integer('content_id').notNull().references(() => content.id, { onDelete: 'cascade' }),
  moderatorId: integer('moderator_id').references(() => users.id),
  flag: text('flag').notNull(),
  notes: text('notes'),
  moderatedAt: timestamp('moderated_at').defaultNow().notNull(),
});

export const comments = pgTable('comments', {
  id: serial('id').primaryKey(),
  contentId: integer('content_id').notNull().references(() => content.id, { onDelete: 'cascade' }),
  parentId: integer('parent_id'),
  authorId: integer('usersor_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  text: text('text').notNull(),
  edited: boolean('edited').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
  deletedAt: timestamp('deleted_at'),
});

export const commentModeration = pgTable('comment_moderation', {
  id: serial('id').primaryKey(),
  commentId: integer('comment_id').notNull().references(() => comments.id, { onDelete: 'cascade' }),
  moderatorId: integer('moderator_id').references(() => users.id),
  flag: text('flag').notNull(),
  notes: text('notes'),
  moderatedAt: timestamp('moderated_at').defaultNow().notNull(),
});

export const userActivities = pgTable('user_activities', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  activityType: activityType('activity_type').notNull(),
  entityId: integer('entity_id'),
  entityType: text('entity_type'),
  activityDetails: jsonb('activity_details'),
  occurredAt: timestamp('occurred_at').defaultNow().notNull(),
});

export const upvotes = pgTable('upvotes', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  entityType: text('entity_type').notNull(), // 'content' or 'comment'
  entityId: integer('entity_id').notNull(),
  upvotedAt: timestamp('upvoted_at').defaultNow().notNull(),
});