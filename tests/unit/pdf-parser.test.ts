import assert from 'node:assert';
import { describe, it } from 'node:test';
import { parseIngPdf } from '../../src/modules/import/pdf-parser';
import { RawTransaction } from '../../src/modules/import/types';

describe('PDF Parser - ING', () => {
    it('should parse ING PDF text correctly', async () => {
        const text = `
            Datum: 18-11-2025
            17-11-2025SEPA Overboeking IBAN:
            NL36INGB0003445588 BIC: INGBNL2A
            Naam: Iemand
            190,00
            17-11-2025BEA, Apple Pay Jumbo Udenhout Kreit
            25,81
            17-11-2025BEA, Apple Pay Albert Heijn 1585
            31,41
        `;

        const transactions: RawTransaction[] = [];
        const errors: string[] = [];

        await parseIngPdf(text, transactions, errors);

        assert.strictEqual(transactions.length, 3);
        assert.strictEqual(transactions[0].amountCents, -19000);
        assert.strictEqual(transactions[1].amountCents, -2581);
        assert.strictEqual(transactions[2].amountCents, -3141);
        assert.strictEqual(transactions[2].description, 'BEA, Apple Pay Albert Heijn 1585');
    });

    it('should handle multi-line descriptions', async () => {
        const text = `
            Datum: 18-11-2025
            18-11-2025SEPA Incasso
            Omschrijving:
            Abonnement
            12,50
        `;
        const transactions: any[] = [];
        const errors: string[] = [];

        await parseIngPdf(text, transactions, errors);

        assert.strictEqual(transactions.length, 1);
        assert.strictEqual(transactions[0].amountCents, -1250);
        assert.ok(transactions[0].description.includes('Abonnement'));
    });
});
