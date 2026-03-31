import CredentialsProvider from "next-auth/providers/credentials"

// Auth options for NextAuth v4
export const authOptions = {
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        try {
          // Dynamic import to ensure Prisma is available in NextAuth context
          const prisma = (await import("@/lib/prisma")).default
          const user = await prisma.user.findUnique({
            where: { email: credentials.email }
          })

          if (!user || !user.password) {
            return null
          }

          const bcrypt = require('bcryptjs')
          const isPasswordValid = await bcrypt.compare(
            credentials.password,
            user.password
          )

          if (!isPasswordValid) {
            return null
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
          }
        } catch (error) {
          console.error('Auth error:', error)
          return null
        }
      }
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.email = user.email
        token.name = user.name
      }
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id
        session.user.email = token.email
        session.user.name = token.name
      }
      return session
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  // Support both AUTH_SECRET and NEXTAUTH_SECRET
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === 'development',
}

// Helper to get session in server components/actions
export async function auth() {
  if (process.env.NODE_ENV === 'development') {
    const prisma = (await import("@/lib/prisma")).default
    const devUserId = process.env.DEV_AUTH_USER_ID

    const user = devUserId
      ? await prisma.user.findUnique({
          where: { id: devUserId },
          select: { id: true, email: true, name: true, image: true }
        })
      : await prisma.user.findFirst({
          orderBy: { createdAt: 'asc' },
          select: { id: true, email: true, name: true, image: true }
        })

    if (!user) {
      throw new Error('Development auth bypass enabled but no user found. Set DEV_AUTH_USER_ID or create a user.')
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image
      },
      expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    }
  }

  const { getServerSession } = await import("next-auth")
  return getServerSession(authOptions)
}
