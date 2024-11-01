"use server"
import { db } from "./db/index";
import { auth } from "@/auth";
import { and, eq, desc, isNull, sql } from 'drizzle-orm';
import { 
  users, profiles, projects, projectMembers, content, 
  comments, upvotes 
} from './db/schema';
import { ContentWithComments, ContentBrowserQueryResponse } from './db-types';
// ----- Profile Queries -----

export async function getUserProfile(userId: number) {
  return await db.query.profiles.findFirst({
    where: eq(profiles.id, userId),
  });
}

// ----- Project Queries -----

export async function getProjects() {
  return await db.query.projects.findMany();
}

export async function getProject(id: number) {
  return await db.query.projects.findFirst({
    where: eq(projects.id, id),
    with: {
      members: {
        with: {
          user: true,
        },
      },
      content: {
        where: isNull(content.deletedAt),
        orderBy: desc(content.createdAt),
      },
    },
  });
}

export async function getUserProjects(userId: number) {
  return await db.query.projectMembers.findMany({
    where: eq(projectMembers.userId, userId),
    with: {
      project: true,
    },
  });
}

// ----- Content Queries -----

export async function getContentByFilter({
  type,
  projectId,
  search,
  sort
}: {
  type?: typeof content.type.enumValues[number];
  projectId?: string;
  search?: string;
  sort?: 'recent' | 'popular';
}): Promise<ContentBrowserQueryResponse[]> {
  let query = db.select({
    id: content.id,
    title: content.title,
    content: content.content,
    type: content.type,
    createdAt: content.createdAt,
    updatedAt: content.updatedAt,
    deletedAt: content.deletedAt,
    projectId: content.projectId,
    authorId: content.authorId,
    author: {
      id: profiles.id,
      name: profiles.username,
    },
    project: {
      id: projects.id,
      projectName: projects.name,
    },
    _count: {
      comments: sql<number>`(SELECT COUNT(*) FROM comments WHERE content_id = ${content.id} AND deleted_at IS NULL)`,
      upvotes: sql<number>`(SELECT COUNT(*) FROM upvotes WHERE entity_type = 'content' AND entity_id = ${content.id})`,
    },
  })
  .from(content)
  .leftJoin(profiles, eq(content.authorId, profiles.id))
  .leftJoin(projects, eq(content.projectId, projects.id))
  .where(() => {
    const conditions = [isNull(content.deletedAt)];
    
    if (type) conditions.push(eq(content.type, type));
    if (projectId) conditions.push(eq(content.projectId, parseInt(projectId)));
    if (search) conditions.push(sql`${content.title} ILIKE ${`%${search}%`} OR ${content.content} ILIKE ${`%${search}%`}`);
    
    return and(...conditions);
  })
  .orderBy(sort === 'recent' 
    ? desc(content.createdAt)
    : desc(sql`(SELECT COUNT(*) FROM upvotes WHERE entity_type = 'content' AND entity_id = ${content.id})`));

  return await query;
}

export async function getContentWithComments(contentId: number): Promise<ContentWithComments | undefined> {
  return await db.query.content.findFirst({
    where: and(
      eq(content.id, contentId),
      isNull(content.deletedAt)
    ),
    with: {
      author: true,
      comments: {
        where: isNull(comments.deletedAt),
        orderBy: desc(comments.createdAt),
        with: {
          author: true,
          upvotes: {
            where: eq(upvotes.entityType, 'comment')
          },
        },
        project: {
          id: projects.id,
          projectName: projects.name,
        },
      },
      upvotes: {
        where: eq(upvotes.entityType, 'content')
      },
    },
  });
}
// Stats Query
export async function getProjectStats(projectId: number) {
  const result = await db.select({
    contentCount: sql<number>`count(distinct ${content.id})`,
    memberCount: sql<number>`count(distinct ${projectMembers.userId})`,
    commentCount: sql<number>`count(distinct ${comments.id})`,
  })
  .from(projects)
  .leftJoin(content, eq(content.projectId, projects.id))
  .leftJoin(projectMembers, eq(projectMembers.projectId, projects.id))
  .leftJoin(comments, eq(comments.contentId, content.id))
  .where(eq(projects.id, projectId))
  .groupBy(projects.id);

  return result[0];
}


    