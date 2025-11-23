import { isValid, parse } from 'date-fns';
import { BankAdapter } from '../types';
import { stringToCents } from '../utils';

export const INGAdapter: BankAdapter = {
    key: 'ING_NL',

    detect: (headers) => {
        // Check op typische ING kolommen
        const required = ['Datum', 'Naam / Omschrijving', 'Rekening', 'Tegenrekening', 'Af Bij', 'Bedrag (EUR)'];
        return required.every(h => headers.includes(h));
    },

    parseRow: (row) => {
        // 1. Datum parsing (YYYYMMDD)
        const dateStr = row['Datum'];
        const date = parse(dateStr, 'yyyyMMdd', new Date());
        if (!isValid(date)) return null; // Skip ongeldige rijen

        // 2. Bedrag Logica
        const rawAmount = stringToCents(row['Bedrag (EUR)']);
        const direction = row['Af Bij']; // "Af" of "Bij"

        // Als het "Af" is, moet het bedrag negatief zijn
        const amountCents = direction === 'Af' ? -Math.abs(rawAmount) : Math.abs(rawAmount);

        // 3. Constructie
        return {
            date,
            amountCents,
            description: row['Mededelingen'] || row['Naam / Omschrijving'],
            counterpartyName: row['Naam / Omschrijving'],
            counterpartyIban: row['Tegenrekening'],
        };
    }
};
