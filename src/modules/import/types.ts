export type RawTransaction = {
    date: Date;
    amountCents: number; // Positief = inkomsten, Negatief = uitgaven
    description: string;
    counterpartyName: string | null;
    counterpartyIban: string | null;
    importHash: string; // Unieke vingerafdruk
};

export interface BankAdapter {
    key: string; // bv. 'ING_CSV_2025'
    detect: (headers: string[]) => boolean; // Herkent deze adapter dit bestand?
    parseRow: (row: Record<string, string>) => Omit<RawTransaction, 'importHash'> | null;
}
