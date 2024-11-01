// drizzle.config.ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema.ts",
  dbCredentials: {
    url: "postgres://default:rgUiJ6MpyL1o@ep-hidden-thunder-a2s8avyj-pooler.eu-central-1.aws.neon.tech:5432/verceldb?sslmode=require",
  },
});
