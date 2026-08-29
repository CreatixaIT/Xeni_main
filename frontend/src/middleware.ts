import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  // Match all pathnames except for
  // - _next (Next.js internals)
  // - static files (e.g. /favicon.ico, /images/*)
  matcher: ['/((?!_next|.*\\..*).*)']
};
