import { withAuth } from 'next-auth/middleware';

export default withAuth({
  pages: { signIn: '/login' },
});

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/drivers/:path*',
    '/pending-drivers/:path*',
    '/users/:path*',
    '/assignments/:path*',
    '/payments/:path*',
    '/caution/:path*',
    '/weekly/:path*',
    '/comments/:path*',
  ],
};
