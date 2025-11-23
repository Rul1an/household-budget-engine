export function stringToCents(value: string): number {
    // 1. Verwijder valuta tekens en whitespace
    let clean = value.replace(/[€$£\s]/g, '');

    // 2. Check formaat: Is de komma een decimaal of duizendtal?
    // Aanname NL context: komma is decimaal separator als er cijfers achter staan
    // We vervangen de komma door een punt voor JS parsing
    if (clean.includes(',') && !clean.includes('.')) {
        clean = clean.replace(',', '.');
    } else if (clean.includes('.') && clean.includes(',')) {
        // Geval: 1.000,50 -> verwijder punten, vervang komma
        clean = clean.replace(/\./g, '').replace(',', '.');
    }

    // 3. Parse naar float en keer 100
    const floatVal = parseFloat(clean);
    if (isNaN(floatVal)) throw new Error(`Invalid amount format: ${value}`);

    // 4. Afronden naar integer om floating point errors (0.99999) te killen
    return Math.round(floatVal * 100);
}

export function centsToEuro(cents: number): string {
    return new Intl.NumberFormat('nl-NL', {
        style: 'currency',
        currency: 'EUR',
    }).format(cents / 100);
}

export async function generateTransactionHash(data: string): Promise<string> {
    // Web Crypto API (werkt in Node 20+ en Edge Runtimes)
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);

    // Convert buffer to hex string
    return Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}
