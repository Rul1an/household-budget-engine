'use client';

import { Button } from '@/components/ui/button';
import { useEffect } from 'react';

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <html>
            <body>
                <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-background text-foreground">
                    <div className="flex flex-col items-center gap-2 text-center">
                        <h2 className="text-2xl font-bold tracking-tight">
                            Kritieke Fout
                        </h2>
                        <p className="text-muted-foreground">
                            Er is een onherstelbare fout opgetreden.
                        </p>
                    </div>
                    <Button onClick={() => reset()}>Herlaad applicatie</Button>
                </div>
            </body>
        </html>
    );
}
