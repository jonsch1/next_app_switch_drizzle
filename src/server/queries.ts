"use server"
import { db } from "./db/index";
import { auth } from "@/auth";
import { and, eq, desc, isNull, sql } from 'drizzle-orm';
import { 
  users, profiles, projects, projectMembers, content, 
  comments, upvotes, curations
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

// Add this new query function
export async function getAllProjectsWithRelations() {
  return await db.query.projects.findMany({
    where: isNull(projects.deletedAt),
    with: {
      owner: {
        columns: {
          name: true,
        },
      },
      members: {
        with: {
          user: true,
        },
      },
      content: {
        where: isNull(content.deletedAt),
      },
      curations: {
        where: isNull(curations.deletedAt),
        with: {
          statement: true,
        },
      },
    },
    orderBy: desc(projects.createdAt),
  });
}

// Add this new query function
export async function getProjectWithStats(projectId: number) {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
    with: {
      owner: {
        columns: {
          name: true,
        }
      },
      members: {
        with: {
          user: true,
        },
      },
      content: {
        where: isNull(content.deletedAt),
        with: {
          author: true,
        },
      },
      curations: {
        where: isNull(curations.deletedAt),
        with: {
          statement: true,
          curator: true,
        },
      },
    },
  });

  if (!project) return null;

  // Get weekly stats
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  // Calculate weekly changes
  const weeklyChanges = {
    statements: project.curations.filter(c => new Date(c.createdAt) > oneWeekAgo).length,
    hypotheses: project.content.filter(c => 
      c.type === 'hypothesis' && new Date(c.createdAt) > oneWeekAgo
    ).length,
    collaborators: project.members.filter(m => 
      new Date(m.joinedAt) > oneWeekAgo
    ).length,
  };

  // Generate weekly stats for the chart
  const weeklyStats = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dayStr = date.toISOString().split('T')[0];
    
    return {
      name: dayStr,
      statements: project.curations.filter(c => 
        new Date(c.createdAt).toISOString().split('T')[0] === dayStr
      ).length,
      hypotheses: project.content.filter(c => 
        c.type === 'hypothesis' && 
        new Date(c.createdAt).toISOString().split('T')[0] === dayStr
      ).length,
    };
  }).reverse();

  // Format recent activity
  const recentActivity = [...project.content, ...project.curations]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10)
    .map((item, id) => ({
      id,
      user: 'content' in item ? item.author.username : item.curator?.username || 'Unknown',
      action: 'content' in item 
        ? `added a new ${item.type}` 
        : 'curated a statement',
      time: new Date(item.createdAt).toLocaleString(),
    }));

  return {
    id: project.id,
    projectName: project.name,
    description: project.description,
    progress: project.progress,
    statementsCurated: project.curations.length,
    hypothesesSubmitted: project.content.filter(c => c.type === 'hypothesis').length,
    collaboratorCount: project.members.length,
    weeklyChanges,
    weeklyStats,
    recentActivity,
    molecularStatements: project.curations.map(c => ({
      id: c.statement.id,
      text: c.statement.enzName + ' ' + c.statement.type + ' ' + c.statement.subName,
      confidence: c.statement.belief || 0,
    })),
  };
}


    