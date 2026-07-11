import { withAuth } from 'next-auth/middleware';

export default withAuth({
  pages: { signIn: '/login' },
});

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/drivers/:path*',
    '/pending-drivers/:path*',
    '/garage/:path*',
    '/owners/:path*',
    '/reports/:path*',
    '/accounting/:path*',
    '/settings/:path*',
    '/users/:path*',
    '/assignments/:path*',
    '/payments/:path*',
    '/caution/:path*',
    '/weekly/:path*',
    '/comments/:path*',
    '/chat/:path*',
  ],
};
