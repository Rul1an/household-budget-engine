import { z } from 'zod';

const envSchema = z.object({
    // Server-side variables
    DATABASE_URL: z.string().url(),
    OPENAI_API_KEY: z.string().min(1).optional(), // Optional for now, required for AI features
    MOCK_AUTH: z.enum(['true', 'false']).optional(),

    // Client-side variables (must be prefixed with NEXT_PUBLIC_)
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

const processEnv = {
    DATABASE_URL: process.env.DATABASE_URL,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    MOCK_AUTH: process.env.MOCK_AUTH,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
};

// Validate environment variables
const parsed = envSchema.safeParse(processEnv);

if (!parsed.success) {
    console.error(
        '❌ Invalid environment variables:',
        JSON.stringify(parsed.error.format(), null, 4)
    );
    // Only throw in production or strict mode, otherwise just log error to avoid breaking build if vars are missing locally
    if (process.env.NODE_ENV === 'production') {
        throw new Error('Invalid environment variables');
    }
}

export const env = parsed.success ? parsed.data : (processEnv as z.infer<typeof envSchema>);
