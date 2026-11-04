import { NextResponse, type NextRequest } from 'next/server';
import { checkToken } from '@/lib/token';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === '/login' || pathname.startsWith('/api/cron')) return NextResponse.next();
  if (await checkToken(req.cookies.get('session')?.value)) return NextResponse.next();
  if (pathname.startsWith('/api/')) return new NextResponse('Unauthorized', { status: 401 });
  return NextResponse.redirect(new URL('/login', req.url));
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
