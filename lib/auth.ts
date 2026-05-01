import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { getUserByEmail } from '@/lib/users'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        const user = getUserByEmail(credentials.email)
        if (!user) return null
        const valid = await bcrypt.compare(credentials.password, user.passwordHash)
        if (!valid) return null
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: null,
          company: user.company,
          role: user.role
        } as any
      }
    })
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        const u = user as any
        token.company = u.company
        token.role = u.role
      }
      return token
    },
    session({ session, token }) {
      const s = session as any
      if (!s.user) s.user = {}
      s.user.company = token.company
      s.user.role = token.role
      s.user.id = token.sub
      return session
    }
  },
  pages: { signIn: '/login' },
  session: { strategy: 'jwt' }
}