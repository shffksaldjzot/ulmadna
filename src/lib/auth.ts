import NextAuth from 'next-auth';

const kakaoClientId = (process.env.KAKAO_CLIENT_ID || '').trim();

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  debug: true,
  providers: [
    {
      id: 'kakao',
      name: 'Kakao',
      type: 'oauth',
      clientId: kakaoClientId,
      clientSecret: 'unused',
      authorization: {
        url: 'https://kauth.kakao.com/oauth/authorize',
        params: { scope: '' },
      },
      token: {
        url: 'https://kauth.kakao.com/oauth/token',
        async request({ params, provider }: any) {
          const body = new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: kakaoClientId,
            redirect_uri: provider.callbackUrl,
            code: params.code as string,
            ...(params.code_verifier
              ? { code_verifier: params.code_verifier as string }
              : {}),
          });

          const res = await fetch('https://kauth.kakao.com/oauth/token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: body.toString(),
          });

          const tokens = await res.json();
          return { tokens };
        },
      },
      userinfo: 'https://kapi.kakao.com/v2/user/me',
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
