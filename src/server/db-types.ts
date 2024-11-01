import { 
    users, profiles, projects, projectMembers, content, 
    comments, upvotes 
  } from '@/server/db/schema';
  
  // Table Inferences
  export type User = typeof users.$inferSelect;
  export type NewUser = typeof users.$inferInsert;
  
  export type Profile = typeof profiles.$inferSelect;
  export type NewProfile = typeof profiles.$inferInsert;
  
  export type Project = typeof projects.$inferSelect;
  export type NewProject = typeof projects.$inferInsert;
  
  export type ProjectMember = typeof projectMembers.$inferSelect;
  export type NewProjectMember = typeof projectMembers.$inferInsert;
  
  export type Content = typeof content.$inferSelect;
  export type NewContent = typeof content.$inferInsert;
  
  export type Comment = typeof comments.$inferSelect;
  export type NewComment = typeof comments.$inferInsert;
  
  export type Upvote = typeof upvotes.$inferSelect;
  export type NewUpvote = typeof upvotes.$inferInsert;

  export type ProjectWithRelations = Project & {
    members: (ProjectMember & {
      user: User;
    })[];
    content: Content[];
  };
  
  export type CommentWithRelations = Comment & {
    author: Profile;
    upvotes: Upvote[];
  };
  
  // Add this type for the getContentByFilter query result
  export type ContentBrowserQueryResponse = {
    id: number;
    title: string;
    content: string;
    type: typeof content.type.enumValues[number];
    createdAt: Date;
    updatedAt: Date | null;
    deletedAt: Date | null;
    projectId: number | null;
    authorId: number;
    author: {
      id: number;
      name: string;
    } | null;
    project: {
      id: number;
      projectName: string;
    } | null;
    _count: {
      comments: number;
      upvotes: number;
    };
  }; 
  
  export type ContentWithComments = Content & {
    author: Profile;
    comments: (Comment & {
      author: Profile;
      upvotes: Upvote[];
    })[];
    upvotes: Upvote[];
    project: {
      id: number;
      projectName: string;
    };
  };