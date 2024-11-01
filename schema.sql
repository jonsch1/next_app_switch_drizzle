CREATE TYPE visibility_type AS ENUM ('public', 'private', 'restricted', 'project');
CREATE TYPE collaboration_type AS ENUM ('open', 'closed', 'request');
CREATE TYPE project_status AS ENUM ('planning', 'active', 'paused', 'completed');
CREATE TYPE content_type AS ENUM ('discussion', 'hypothesis', 'educational', 'patient_story', 'research_update');
CREATE TYPE content_format AS ENUM ('text', 'video', 'image', 'document');
CREATE TYPE role_type AS ENUM ('member', 'moderator');
CREATE TYPE activity_type AS ENUM (
  'profile_update', 'project_creation', 'project_update',
  'content_creation', 'content_update', 'comment_creation',
  'comment_update', 'project_join', 'project_leave'
);
-- Add curation status enum
CREATE TYPE curation_status AS ENUM ('accepted', 'rejected', 'uncertain');
COMMENT ON TYPE curation_status IS 'Status of a statement curation: accepted, rejected, uncertain';
-- 2. Profiles Table
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  username TEXT UNIQUE NOT NULL,
  bio TEXT,
  location TEXT,
  website TEXT,
  social_links JSON,
  credentials JSON,
  organization TEXT,
  position TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  last_active TIMESTAMP DEFAULT NOW() NOT NULL,
  notification_preferences JSON,
  deleted_at TIMESTAMP
);
COMMENT ON TABLE profiles IS 'User profile information extending auth.users data';

-- 3. Projects Table
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  disease TEXT NOT NULL,
  description TEXT NOT NULL,
  research_goals TEXT[],
  visibility visibility_type NOT NULL,
  collaboration collaboration_type NOT NULL,
  progress NUMERIC(5,2) DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  status project_status NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP,
  deleted_at TIMESTAMP
);
COMMENT ON TABLE projects IS 'Research projects that can be collaborated on by multiple users';

CREATE TABLE statements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL,
  belief NUMERIC(4,3) CHECK (belief >= 0 AND belief <= 1),
  enz_name TEXT,
  sub_name TEXT,
  subj_name TEXT,
  obj_name TEXT,
  obj_activity TEXT,
  matches_hash TEXT,
  position TEXT,
  residue TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP,
  deleted_at TIMESTAMP
);
COMMENT ON TABLE statements IS 'Scientific statements with belief scores and entity relationships';

CREATE TABLE statement_members (
  statement_id UUID REFERENCES statements(id) ON DELETE CASCADE,
  member_name TEXT NOT NULL,
  PRIMARY KEY (statement_id, member_name)
);
COMMENT ON TABLE statement_members IS 'Entity members associated with statements';

CREATE TABLE evidence (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  statement_id UUID NOT NULL REFERENCES statements(id) ON DELETE CASCADE,
  pmid TEXT,
  source_api TEXT,
  source_hash TEXT,
  text TEXT,
  text_refs JSON,
  annotations JSON,
  context_type TEXT,
  context_cell_line TEXT,
  context_location TEXT,
  context_organ TEXT,
  context_species TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);
COMMENT ON TABLE evidence IS 'Evidence supporting scientific statements';


-- 4. Project Members Join Table
CREATE TABLE project_members (
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role role_type NOT NULL,
  joined_at TIMESTAMP DEFAULT NOW() NOT NULL,
  PRIMARY KEY (project_id, user_id)
);
COMMENT ON TABLE project_members IS 'Association table for project members and their roles';

-- 5. Project Pending Applications Table
CREATE TABLE project_pending_applications (
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  applied_at TIMESTAMP DEFAULT NOW() NOT NULL,
  PRIMARY KEY (project_id, user_id)
);
COMMENT ON TABLE project_pending_applications IS 'Pending user applications to join projects';

-- Create curations table
CREATE TABLE curations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  statement_id UUID NOT NULL REFERENCES statements(id) ON DELETE RESTRICT,
  curator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  status curation_status NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP,
  deleted_at TIMESTAMP,
  UNIQUE(statement_id, curator_id, project_id)
);
COMMENT ON TABLE curations IS 'User evaluations of scientific statements, optionally associated with projects';


-- 6. Content Table
CREATE TABLE content (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  type content_type NOT NULL,
  format content_format NOT NULL,
  metadata JSONB,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  visibility visibility_type NOT NULL,
  edited BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP,
  deleted_at TIMESTAMP
);
COMMENT ON TABLE content IS 'User-generated content associated with projects';

-- 7. Content Upvotes Join Table
CREATE TABLE content_upvotes (
  content_id UUID NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  upvoted_at TIMESTAMP DEFAULT NOW() NOT NULL,
  PRIMARY KEY (content_id, user_id)
);
COMMENT ON TABLE content_upvotes IS 'User upvotes on content items';

-- 8. Content Moderation Table
CREATE TABLE content_moderation (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_id UUID NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  moderator_id UUID REFERENCES auth.users(id),
  flag TEXT NOT NULL,
  notes TEXT,
  moderated_at TIMESTAMP DEFAULT NOW() NOT NULL
);
COMMENT ON TABLE content_moderation IS 'Moderation actions on content items';

-- 9. Comments Table
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_id UUID NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  edited BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP,
  deleted_at TIMESTAMP
);
COMMENT ON TABLE comments IS 'User comments on content items with threading support';

-- 10. Comment Upvotes Join Table
CREATE TABLE comment_upvotes (
  comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  upvoted_at TIMESTAMP DEFAULT NOW() NOT NULL,
  PRIMARY KEY (comment_id, user_id)
);
COMMENT ON TABLE comment_upvotes IS 'User upvotes on comments';

-- 11. Comment Moderation Table
CREATE TABLE comment_moderation (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  moderator_id UUID REFERENCES auth.users(id),
  flag TEXT NOT NULL,
  notes TEXT,
  moderated_at TIMESTAMP DEFAULT NOW() NOT NULL
);
COMMENT ON TABLE comment_moderation IS 'Moderation actions on comments';

-- 15. Activity Logs Table
CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  activity_type activity_type NOT NULL,
  entity_id UUID,
  entity_type TEXT,
  activity_details JSONB,
  occurred_at TIMESTAMP DEFAULT NOW() NOT NULL
);
COMMENT ON TABLE activity_logs IS 'Logs of user activities for auditing and insights';

-- 17. Content Versions Table
CREATE TABLE content_versions (
  version_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_id UUID NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  title TEXT,
  content TEXT,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_by UUID REFERENCES auth.users(id)
);
COMMENT ON TABLE content_versions IS 'Version history for content items';

-- 18. Comment Versions Table
CREATE TABLE comment_versions (
  version_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  text TEXT,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_by UUID REFERENCES auth.users(id)
);
COMMENT ON TABLE comment_versions IS 'Version history for comments';