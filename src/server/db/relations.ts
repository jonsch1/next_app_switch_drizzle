import { relations } from 'drizzle-orm';
import { users, profiles, content, comments, projects, upvotes, projectMembers } from './schema';

export const usersRelations = relations(users, ({ many, one }) => ({
    profile: one(profiles, {
      fields: [users.id],
      references: [profiles.id],
    }),
    contents: many(content),
    comments: many(comments),
  }));
  
  export const profilesRelations = relations(profiles, ({ one }) => ({
    user: one(users, {
      fields: [profiles.id],
      references: [users.id],
    }),
  }));
  
  export const contentRelations = relations(content, ({ one, many }) => ({
    author: one(profiles, {
      fields: [content.authorId],
      references: [profiles.id],
    }),
    project: one(projects, {
      fields: [content.projectId],
      references: [projects.id],
    }),
    comments: many(comments),
    upvotes: many(upvotes),
  }));
  
  export const commentsRelations = relations(comments, ({ one, many }) => ({
    content: one(content, {
      fields: [comments.contentId],
      references: [content.id],
    }),
    author: one(profiles, {
      fields: [comments.authorId],
      references: [profiles.id],
    }),
    upvotes: many(upvotes),
  }));
  
  export const projectsRelations = relations(projects, ({ many, one }) => ({
    owner: one(users, {
      fields: [projects.userId],
      references: [users.id],
    }),
    members: many(projectMembers),
    content: many(content),
  }));
  
  export const projectMembersRelations = relations(projectMembers, ({ one }) => ({
    project: one(projects, {
      fields: [projectMembers.projectId],
      references: [projects.id],
    }),
    user: one(users, {
      fields: [projectMembers.userId],
      references: [users.id],
    }),
  }));

export const upvotesRelations = relations(upvotes, ({ one }) => ({
  content: one(content, {
    fields: [upvotes.entityId],
    references: [content.id],
  }),
  comment: one(comments, {
    fields: [upvotes.entityId],
    references: [comments.id],
  }),
}));