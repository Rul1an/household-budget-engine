import Papa from 'papaparse';
import { INGAdapter } from './adapters/ing';
import { RaboAdapter } from './adapters/rabo';
import { RawTransaction } from './types';
import { generateTransactionHash } from './utils';

const ADAPTERS = [INGAdapter, RaboAdapter];

export async function parseBankExport(csvString: string): Promise<{
    transactions: RawTransaction[];
    errors: string[];
    adapterUsed: string;
}> {
    const transactions: RawTransaction[] = [];
    const errors: string[] = [];
    let activeAdapter: typeof ADAPTERS[0] | null = null;

    return new Promise((resolve) => {
        Papa.parse(csvString, {
            header: true,
            skipEmptyLines: true,

            // Stap 1: Detecteer Adapter op basis van de headers (eerste chunk)
            beforeFirstChunk: (chunk) => {
                const firstLine = chunk.split('\n')[0];
                // Quick hack om headers te krijgen zonder volledige parse
                const parsed = Papa.parse(firstLine);
                const headers = (parsed.data && parsed.data.length > 0) ? parsed.data[0] as string[] : [];

                if (!headers || headers.length === 0) {
                    console.warn('Could not parse headers from first line:', firstLine);
                    return;
                }

                activeAdapter = ADAPTERS.find(a => a.detect(headers)) || null;

                if (!activeAdapter) {
                    errors.push("Geen ondersteund bankformaat herkend.");
                    // In productie wil je hier misschien de parse stoppen
                }
            },

            // Stap 2: Process row-by-row
            step: async (results, parser) => {
                if (!activeAdapter) return;

                // Pauseer parser voor async operaties
                parser.pause();

                try {
                    const row = results.data as Record<string, string>;
                    const baseTxn = activeAdapter.parseRow(row);

                    if (baseTxn) {
                        // Stap 3: Genereer hash (Async)
                        const hashData = `${baseTxn.date.toISOString()}_${baseTxn.amountCents}_${baseTxn.counterpartyIban || ''}_${baseTxn.description}`;
                        const hash = await generateTransactionHash(hashData);

                        transactions.push({ ...baseTxn, importHash: hash });
                    }
                } catch (e) {
                    errors.push(`Fout in regel ${results.errors}: ${(e as Error).message}`);
                } finally {
                    // Hervat parser
                    parser.resume();
                }
            },

            // Stap 4: Klaar
            complete: () => {
                resolve({
                    transactions,
                    errors,
                    adapterUsed: activeAdapter?.key || 'UNKNOWN'
                });
            }
        });
    });
}
