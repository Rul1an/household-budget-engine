import { isValid, parse } from 'date-fns';
import { BankAdapter } from '../types';
import { stringToCents } from '../utils';

export const RaboAdapter: BankAdapter = {
    key: 'RABO_NL',
    detect: (headers) => headers.includes('IBAN/BBAN') && headers.includes('Volgnr'),

    parseRow: (row) => {
        // Rabo datum: 2025-01-31 of 31-01-2025 (afhankelijk van export instelling gebruiker)
        // Hier moet je robuust zijn.
        let date = parse(row['Datum'], 'yyyy-MM-dd', new Date());
        if (!isValid(date)) {
            date = parse(row['Datum'], 'dd-MM-yyyy', new Date());
        }
        if (!isValid(date)) return null;

        const amountCents = stringToCents(row['Bedrag']);
        // Rabo gebruikt vaak "-" teken in de string zelf, stringToCents pakt dat vaak al,
        // maar check of er een aparte 'Munt' of 'Credit/Debit' kolom is.
        // Voor nu nemen we aan dat 'Bedrag' het teken bevat (standaard Rabo CSV)

        return {
            date,
            amountCents,
            description: (row['Omschrijving-1'] || '') + ' ' + (row['Omschrijving-2'] || ''),
            counterpartyName: row['Naam tegenpartij'],
            counterpartyIban: row['Tegenrekening IBAN/BBAN'],
        };
    }
};
