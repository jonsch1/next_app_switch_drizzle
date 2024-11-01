"use server"
import { db } from "./db/index";
import { auth } from "@/auth";
import { 
 profiles, projects, projectMembers, content, comments,
  upvotes, projectPendingApplications
} from "./db/schema";
import { eq, and, isNull } from "drizzle-orm";

// Helper function to get authenticated user ID
async function getAuthenticatedUserId() {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Not authenticated")
  return parseInt(session.user.id)
}

// User mutations
export async function updateProfile(data: Partial<typeof profiles.$inferInsert>) {
  const userId = await getAuthenticatedUserId()
  return await db
    .update(profiles)
    .set({ ...data })
    .where(eq(profiles.id, userId))
    .returning()
}

// Project mutations
export async function createProject(
  data: Omit<typeof projects.$inferInsert, 'userId'>
) {
  const userId = await getAuthenticatedUserId()
  const project = await db
    .insert(projects)
    .values({ ...data, userId })
    .returning()

  if (project[0]) {
    await db.insert(projectMembers).values({
      projectId: project[0].id,
      userId,
      role: 'moderator'
    })
  }

  return project
}

// Content mutations
export async function createContent(
  data: Omit<typeof content.$inferInsert, 'authorId'>
) {
  const userId = await getAuthenticatedUserId()
  return await db
    .insert(content)
    .values({ ...data, authorId: userId })
    .returning()
}



// Project membership mutations
export async function applyToProject(projectId: number) {
  const userId = await getAuthenticatedUserId()
  return await db
    .insert(projectPendingApplications)
    .values({ userId, projectId })
    .returning()
}


// Voting Mutations

export async function toggleContentUpvote(contentId: number, userId: number) {
  const existing = await db.query.upvotes.findFirst({
    where: and(
      eq(upvotes.entityType, 'content'),
      eq(upvotes.entityId, contentId),
      eq(upvotes.userId, userId)
    ),
  });

  if (existing) {
    await db.delete(upvotes)
      .where(and(
        eq(upvotes.entityType, 'content'),
        eq(upvotes.entityId, contentId),
        eq(upvotes.userId, userId)
      ));
    return false; // Upvote removed
  } else {
    await db.insert(upvotes)
      .values({ 
        entityType: 'content',
        entityId: contentId, 
        userId 
      });
    return true; // Upvote added
  }
}

// Comment Upvotes
export async function toggleCommentUpvote(commentId: number, userId: number) {
  const existing = await db.query.upvotes.findFirst({
    where: and(
      eq(upvotes.entityType, 'comment'),
      eq(upvotes.entityId, commentId),
      eq(upvotes.userId, userId)
    ),
  });

  if (existing) {
    await db.delete(upvotes)
      .where(and(
        eq(upvotes.entityType, 'comment'),
        eq(upvotes.entityId, commentId),
        eq(upvotes.userId, userId)
      ));
    return false; // Upvote removed
  } else {
    await db.insert(upvotes)
      .values({ 
        entityType: 'comment',
        entityId: commentId, 
        userId 
      });
    return true; // Upvote added
  }
}

// Comment mutations
export async function createComment(
  data: Omit<typeof comments.$inferInsert, 'authorId'>
) {
  const userId = await getAuthenticatedUserId()
  return await db
    .insert(comments)
    .values({ ...data, authorId: userId })
    .returning()
}

// Add these new comment mutations
export async function updateComment(commentId: number, text: string) {
  const userId = await getAuthenticatedUserId()
  
  // First verify the user owns this comment
  const comment = await db.query.comments.findFirst({
    where: and(
      eq(comments.id, commentId),
      eq(comments.authorId, userId)
    ),
  })
  
  if (!comment) throw new Error("Comment not found or unauthorized")

  return await db
    .update(comments)
    .set({ text })
    .where(eq(comments.id, commentId))
    .returning()
}


export async function deleteComment(commentId: number) {
  const userId = await getAuthenticatedUserId()
  
  // First verify the user owns this comment
  const comment = await db.query.comments.findFirst({
    where: and(
      eq(comments.id, commentId),
      eq(comments.authorId, userId)
    ),
  })
  
  if (!comment) throw new Error("Comment not found or unauthorized")

  return await db
    .delete(comments)
    .where(eq(comments.id, commentId))
    .returning()
}

// Add this new mutation
export async function updateContent(
  contentId: number,
  data: Partial<Omit<typeof content.$inferInsert, 'authorId'>>
) {
  const userId = await getAuthenticatedUserId()
  
  // First verify the user owns this content
  const existingContent = await db.query.content.findFirst({
    where: and(
      eq(content.id, contentId),
      eq(content.authorId, userId)
    ),
  })
  
  if (!existingContent) throw new Error("Content not found or unauthorized")

  return await db
    .update(content)
    .set(data)
    .where(eq(content.id, contentId))
    .returning()
}

// Add this new mutation
export async function deleteContent(contentId: number) {
  const userId = await getAuthenticatedUserId()
  
  // First verify the user owns this content
  const existingContent = await db.query.content.findFirst({
    where: and(
      eq(content.id, contentId),
      eq(content.authorId, userId)
    ),
  })
  
  if (!existingContent) throw new Error("Content not found or unauthorized")

  return await db
    .delete(content)
    .where(eq(content.id, contentId))
    .returning()
}