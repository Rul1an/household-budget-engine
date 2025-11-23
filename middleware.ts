import { updateSession } from '@/lib/supabase/middleware'
import { type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
    return await updateSession(request)
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - auth/ (login routes)
         * - login/ (login page)
         * - api/ (api routes - optional, but usually we want to protect them too, or handle auth inside)
         */
        '/((?!_next/static|_next/image|favicon.ico|auth/.*|login|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
