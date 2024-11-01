import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import { db } from "./server/db"
import { users, profiles } from "./server/db/schema"
import { eq } from "drizzle-orm"

export const {
  handlers,
  auth,
  signIn,
  signOut
} = NextAuth({
  providers: [Google({
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!
  })],
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt"
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!user.email) return false
      
      try {
        // Check if user exists
        const existingUser = await db.select()
          .from(users)
          .where(eq(users.email, user.email))
          .limit(1)

        if (!existingUser.length) {
          // Create new user and profile if they don't exist
          await db.insert(users).values({
            email: user.email,
            name: user.name ?? null,
          })

          // Create profile separately
          const [newUser] = await db.select()
            .from(users)
            .where(eq(users.email, user.email))
            .limit(1)

          await db.insert(profiles).values({
            id: newUser.id,
            username: user.name ?? null,
          })
        }
        
        return true
      } catch (error) {
        console.error("Error during sign in:", error)
        return false
      }
    },
    async session({ session, token }) {
      if (session?.user) {
        const [dbUser] = await db.select()
          .from(users)
          .where(eq(users.email, session.user.email ?? ""))
          .limit(1)
        
        if (dbUser) {
          session.user.id = dbUser.id.toString()
        }
      }
      return session
    },
  }
})
