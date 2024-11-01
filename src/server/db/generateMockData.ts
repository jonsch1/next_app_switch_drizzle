import { faker } from '@faker-js/faker';
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/vercel-postgres';

import { sql } from "@vercel/postgres";
import * as schema from "./schema";
// Use this object to send drizzle queries to your DB

export const db = drizzle(sql, { schema });
async function generateMockData() {
  // Generate 50 users with corresponding profiles
  const userIds = [];
  for (let i = 0; i < 50; i++) {
    const [user] = await db.insert(schema.users).values({
      email: faker.internet.email(),
      name: faker.person.fullName(),
      image: faker.image.avatar(),
    }).returning({ id: schema.users.id });

    userIds.push(user.id);

    await db.insert(schema.profiles).values({
      id: user.id,
      username: faker.internet.username(),
      bio: faker.lorem.paragraph(),
      location: faker.location.city(),
      website: faker.internet.url(),
      socialLinks: {
        twitter: faker.internet.username(),
        linkedin: faker.internet.username(),
      },
      credentials: {
        education: faker.helpers.arrayElements([
          'PhD in Biology',
          'MD',
          'MS in Biochemistry',
          'BS in Chemistry'
        ]),
        certifications: faker.helpers.arrayElements([
          'Board Certified',
          'Research Fellow',
          'Clinical Research Certificate'
        ]),
      },
      organization: faker.company.name(),
      position: faker.person.jobTitle(),
    });
  }

  // Generate 20 projects
  const projectIds = [];
  for (let i = 0; i < 20; i++) {
    const [project] = await db.insert(schema.projects).values({
      userId: userIds[i],
      name: faker.helpers.arrayElement([
        "Alzheimer's Research Initiative",
        "Cancer Immunotherapy Study",
        "Rare Disease Network",
        "COVID-19 Long-term Effects",
      ]),
      disease: faker.helpers.arrayElement([
        "Alzheimer's",
        "Breast Cancer",
        "Type 2 Diabetes",
        "Multiple Sclerosis",
      ]),
      description: faker.lorem.paragraphs(2),
      researchGoals: faker.helpers.multiple(() => faker.lorem.sentence(), { count: 3 }),
      visibility: faker.helpers.arrayElement(['public', 'private', 'restricted']),
      collaboration: faker.helpers.arrayElement(['open', 'closed', 'request']),
      progress: faker.number.float({ min: 0, max: 100, fractionDigits: 2 }).toString(),
      status: faker.helpers.arrayElement(['active', 'inactive', 'completed']),
    }).returning({ id: schema.projects.id });

    projectIds.push(project.id);
  }

  // Generate 100 statements with evidence
  const statementIds = [];
  for (let i = 0; i < 100; i++) {
    const [statement] = await db.insert(schema.statements).values({
      type: faker.helpers.arrayElement(['activation', 'inhibition', 'binding']) as 'activation' | 'inhibition' | 'binding',
      belief: faker.number.float({ min: 0, max: 1, fractionDigits: 3 }).toString(),
      enzName: faker.science.chemicalElement().name,
      subName: faker.science.chemicalElement().name,
      members: faker.helpers.multiple(() => faker.science.chemicalElement().name, { count: 3 }),
    }).returning({ id: schema.statements.id });

    statementIds.push(statement.id);

    // Add 1-3 pieces of evidence per statement
    const evidenceCount = faker.number.int({ min: 1, max: 3 });
    for (let j = 0; j < evidenceCount; j++) {
      await db.insert(schema.evidence).values({
        statementId: statement.id,
        pmid: faker.string.numeric(8),
        sourceApi: faker.helpers.arrayElement(['pubmed', 'europepmc', 'biorxiv']),
        text: faker.lorem.paragraph(),
        textRefs: {
          doi: `10.1${faker.string.numeric(4)}/${faker.string.alphanumeric(8)}`,
          pmcid: `PMC${faker.string.numeric(7)}`,
        },
        contextSpecies: faker.helpers.arrayElement(['human', 'mouse', 'rat']),
      });
    }
  }

  // Generate curations
  for (let i = 0; i < 200; i++) {
    await db.insert(schema.curations).values({
      statementId: faker.helpers.arrayElement(statementIds),
      curatorId: faker.helpers.arrayElement(userIds),
      projectId: faker.helpers.arrayElement(projectIds),
      status: faker.helpers.arrayElement(['accepted', 'rejected', 'uncertain']),
      notes: faker.lorem.paragraph(),
    });
  }

  // Generate content
  const contentIds = [];
  for (let i = 0; i < 50; i++) {
    const [content] = await db.insert(schema.content).values({
      title: faker.lorem.sentence(),
      content: faker.lorem.paragraphs(3),
      type: faker.helpers.arrayElement(['discussion', 'hypothesis', 'educational', 'patient_story']),
      projectId: faker.helpers.arrayElement(projectIds),
      authorId: faker.helpers.arrayElement(userIds),
    }).returning({ id: schema.content.id });

    contentIds.push(content.id);
  }

  // Generate comments
  const commentIds: typeof schema.comments.$inferSelect['id'][] = [];
  const commentsByContent = new Map<string, typeof schema.comments.$inferSelect['id'][]>();
  
  // First, create top-level comments
  for (let i = 0; i < 100; i++) {
    const contentId = faker.helpers.arrayElement(contentIds);
    const [comment] = await db.insert(schema.comments).values({
      contentId,
      parentId: null,
      authorId: faker.helpers.arrayElement(userIds),
      text: faker.lorem.paragraph(),
    }).returning({ id: schema.comments.id });

    commentIds.push(comment.id);
    
    // Track comments by their content ID for replies
    if (!commentsByContent.has(contentId.toString())) {
      commentsByContent.set(contentId.toString(), []);
    }
    commentsByContent.get(contentId.toString())!.push(comment.id);
  }

  // Then create replies
  for (let i = 0; i < 100; i++) {
    // Pick a random content ID that has comments
    const contentId = parseInt(faker.helpers.arrayElement(Array.from(commentsByContent.keys())), 10);
    const possibleParents = commentsByContent.get(contentId.toString())!;
    const parentId = faker.helpers.arrayElement(possibleParents);

    const [comment] = await db.insert(schema.comments).values({
      contentId, // Same contentId as parent
      parentId,
      authorId: faker.helpers.arrayElement(userIds),
      text: faker.lorem.paragraph(),
    }).returning({ id: schema.comments.id });

    commentIds.push(comment.id);
    commentsByContent.get(contentId.toString())!.push(comment.id);
  }

  // Generate upvotes for content and comments
  for (let i = 0; i < 500; i++) {
    const entityType = faker.helpers.arrayElement(['content', 'comment']) as 'content' | 'comment';
    const entityId = entityType === 'content' 
      ? faker.helpers.arrayElement(contentIds)
      : faker.helpers.arrayElement(commentIds);
      
    // Try-catch to handle potential duplicate upvotes
    try {
      await db.insert(schema.upvotes).values({
        userId: faker.helpers.arrayElement(userIds),
        entityType,
        entityId,
      });
    } catch (error) {
      // Silently continue if duplicate upvote
      continue;
    }
  }

  // Generate activities
  for (let i = 0; i < 300; i++) {
    await db.insert(schema.userActivities).values({
      userId: faker.helpers.arrayElement(userIds),
      activityType: faker.helpers.arrayElement([
        'profile_update', 'project_creation', 'project_update',
        'content_creation', 'content_update', 'comment_creation',
        'comment_update', 'project_join', 'project_leave'
      ]),
      entityId: faker.helpers.arrayElement([...projectIds, ...contentIds, ...commentIds]),
      entityType: faker.helpers.arrayElement(['project', 'content', 'comment']),
      activityDetails: {
        description: faker.lorem.sentence(),
        previousValue: faker.lorem.words(3),
        newValue: faker.lorem.words(3),
      },
    });
  }

  console.log('Mock data generation completed!');
}

generateMockData().catch(console.error);