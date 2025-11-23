'use client';

import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';
import { useEffect } from 'react';

export default function Error({
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
        <div className="flex h-[50vh] w-full flex-col items-center justify-center gap-4">
            <div className="flex flex-col items-center gap-2 text-center">
                <div className="rounded-full bg-red-100 p-3 dark:bg-red-900/20">
                    <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-500" />
                </div>
                <h2 className="text-xl font-semibold tracking-tight">
                    Er is iets misgegaan
                </h2>
                <p className="text-sm text-muted-foreground">
                    {error.message || 'Er is een onverwachte fout opgetreden.'}
                </p>
            </div>
            <Button onClick={() => reset()} variant="outline">
                Probeer opnieuw
            </Button>
        </div>
    );
}
