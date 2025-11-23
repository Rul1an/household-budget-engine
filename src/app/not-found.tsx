import { Button } from '@/components/ui/button';
import { FileQuestion } from 'lucide-react';
import Link from 'next/link';

export default function NotFound() {
    return (
        <div className="flex h-[50vh] w-full flex-col items-center justify-center gap-4">
            <div className="flex flex-col items-center gap-2 text-center">
                <div className="rounded-full bg-muted p-3">
                    <FileQuestion className="h-6 w-6 text-muted-foreground" />
                </div>
                <h2 className="text-xl font-semibold tracking-tight">
                    Pagina niet gevonden
                </h2>
                <p className="text-sm text-muted-foreground">
                    De pagina die je zoekt bestaat niet of is verplaatst.
                </p>
            </div>
            <Button asChild variant="outline">
                <Link href="/">Terug naar Dashboard</Link>
            </Button>
        </div>
    );
}
