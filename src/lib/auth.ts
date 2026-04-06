import NextAuth from 'next-auth';

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  debug: true,
  providers: [
    {
      id: 'kakao',
      name: 'Kakao',
      type: 'oauth',
      clientId: (process.env.KAKAO_CLIENT_ID || '').trim(),
      clientSecret: '',
      authorization: {
        url: 'https://kauth.kakao.com/oauth/authorize',
        params: { scope: '' },
      },
      token: 'https://kauth.kakao.com/oauth/token',
      userinfo: 'https://kapi.kakao.com/v2/user/me',
      client: {
        token_endpoint_auth_method: 'none',
      },
      profile(profile: any) {
        return {
          id: String(profile.id),
          name: profile.kakao_account?.profile?.nickname,
          image: profile.kakao_account?.profile?.thumbnail_image_url,
          email: profile.kakao_account?.email,
        };
      },
    },
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
