import NextAuth from 'next-auth';
import Kakao from 'next-auth/providers/kakao';

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  debug: true,
  providers: [
    Kakao({
      clientId: (process.env.KAKAO_CLIENT_ID || '').trim(),
      clientSecret: (process.env.KAKAO_CLIENT_SECRET || '').trim(),
    }),
  ],
  pages: {
    signIn: '/login',
  },
  callbacks: {
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
});
