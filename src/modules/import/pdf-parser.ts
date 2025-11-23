import { isValid, parse } from 'date-fns';
import { RawTransaction } from './types';
import { generateTransactionHash, stringToCents } from './utils';

export async function parsePdfBankExport(buffer: Buffer): Promise<{
    transactions: RawTransaction[];
    errors: string[];
    adapterUsed: string;
}> {
    const transactions: RawTransaction[] = [];
    const errors: string[] = [];
    let adapterUsed = 'UNKNOWN';

    try {
        // Use pdf-parse with lazy require to avoid initialization issues
        const pdfParse = require('pdf-parse');
        const data = await pdfParse(buffer);
        const text = data.text;

        // 1. Detect Bank
        if (text.includes('Rabobank') || text.includes('Rekeningafschrift')) {
            adapterUsed = 'RABO_PDF';
            await parseRaboPdf(text, transactions, errors);
        } else if (text.includes('ING Bank N.V.') || text.includes('Af- en bijschrijvingen') || text.includes('Bij- en afschrijvingen')) {
            adapterUsed = 'ING_PDF';
            await parseIngPdf(text, transactions, errors);
        } else {
            errors.push('Onbekend PDF-formaat. Ondersteunde formaten: Rabobank, ING.');
        }

    } catch (e) {
        errors.push(`PDF verwerking mislukt: ${(e as Error).message}`);
    }

    return { transactions, errors, adapterUsed };
}

export async function parseRaboPdf(text: string, transactions: RawTransaction[], errors: string[]) {
    const lines = text.split('\n').filter(l => l.trim().length > 0);

    // Look for transaction lines starting with date pattern: DD-MM
    // Regex breakdown:
    // 1. Date: (\d{2}-\d{2})
    // 2. Type: ([a-z]{2})
    // 3. Middle: (.*?) - non-greedy match for description
    // 4. Amount: (\d[\d\.]*,\d{2}) - matches digit, optional dots/digits, comma, 2 digits.
    const transactionRegex = /^(\d{2}-\d{2})([a-z]{2})(.*?)(\d[\d\.]*,\d{2})$/;

    let i = 0;
    while (i < lines.length) {
        const line = lines[i].trim();
        const match = line.match(transactionRegex);

        if (match) {
            try {
                const dateStr = match[1];
                const transactionType = match[2].toLowerCase();
                const middlePartRaw = match[3];
                const middlePart = middlePartRaw.trim();
                const amountStr = match[4];

                const rawAmount = stringToCents(amountStr);

                // Rabobank Transaction Codes
                // Most are Debit (Af). Credits (Bij) are rarer or use specific codes.
                // CB = Crediteurenbetaling (Debit)
                // EI = Euro-incasso (Debit)
                // TB = Eigen rekening / Overboeking (Usually Debit if outgoing)
                // IC = Incasso (Debit)
                // GT = Internetbankieren (Debit)
                // OV = Overschrijving (Debit)
                // BA = Betaalautomaat (Debit)
                const debitTypes = ['ei', 'bc', 'ba', 'bg', 'wb', 'st', 'db', 'cb', 'tb', 'ic', 'gt', 'ov', 'ac'];

                // Heuristic for Credit/Debit based on columns:
                // "Bedrag af" is the first amount column.
                // "Bedrag bij" is the second amount column.
                // If there is a large gap (spaces) before the amount, it's likely in the second column (Credit).
                // If the amount is glued to the text or has 1 space, it's likely in the first column (Debit).

                // Check for trailing spaces in middlePartRaw
                // Note: pdf-parse might merge text if close.
                const hasGap = middlePartRaw.match(/\s{3,}$/); // 3 or more spaces at the end

                let amountCents: number;

                if (hasGap) {
                    // Likely Credit
                    amountCents = Math.abs(rawAmount);
                } else if (debitTypes.includes(transactionType)) {
                    // Known Debit type and no gap
                    amountCents = -Math.abs(rawAmount);
                } else {
                    // Default to Debit (Negative) for safety, as most are payments
                    amountCents = -Math.abs(rawAmount);
                }

                const ibanMatch = middlePart.match(/(NL\d{2}[\s]?[A-Z]{4}[\s]?\d{4}[\s]?\d{4}[\s]?\d{2})/);
                const iban = ibanMatch ? ibanMatch[1].replace(/\s/g, '') : '';

                let counterparty = '';
                let description = '';

                if (i + 1 < lines.length) {
                    counterparty = lines[i + 1].trim();
                    i++;
                }
                if (i + 1 < lines.length && !lines[i + 1].match(transactionRegex)) {
                    description = lines[i + 1].trim();
                    i++;
                }

                description = description || middlePart;

                const yearMatch = text.match(/Datum vanaf\s+\d{2}-\d{2}-(\d{4})/);
                const year = yearMatch ? yearMatch[1] : new Date().getFullYear().toString();

                const fullDateStr = `${dateStr}-${year}`;
                const date = parse(fullDateStr, 'dd-MM-yyyy', new Date());

                if (!isValid(date)) {
                    errors.push(`Ongeldige datum: ${fullDateStr}`);
                    continue;
                }

                const hashData = `${date.toISOString()}_${amountCents}_${iban}_${description}`;
                const hash = await generateTransactionHash(hashData);

                transactions.push({
                    date,
                    amountCents,
                    description,
                    counterpartyName: counterparty || description,
                    counterpartyIban: iban,
                    importHash: hash
                });

            } catch (e) {
                errors.push(`Fout bij verwerken regel ${i}: ${(e as Error).message}`);
            }
        }

        i++;
    }

    if (transactions.length === 0) {
        errors.push('Geen transacties gevonden in Rabobank PDF. Het formaat kan niet ondersteund worden.');
    }
}

export async function parseIngPdf(text: string, transactions: RawTransaction[], errors: string[]) {
    const lines = text.split('\n').filter(l => l.trim().length > 0);

    // ING PDF Pattern based on debug-pdf.js output:
    // Date: 17-11
    // Type: cb (or other 2 letter code)
    // Description: ...
    // Amount: 88190,00 (no thousand separator usually in regex match, but stringToCents handles it)
    //
    // Example line: "17-11cbNL36 INGB 0003 4455 88190,00"
    // Regex: /^(\d{2}-\d{2})([a-z]{2})(.*?)(\d[\d\.]*,\d{2})$/
    // This is remarkably similar to Rabo, likely because pdf-parse flattens the layout similarly.

    const transactionRegex = /^(\d{2}-\d{2})([a-z]{2})(.*?)(\d[\d\.]*,\d{2})$/;

    // ING Transaction Codes (Af/Bij detection is tricky without column position)
    // However, ING PDF usually puts "Af" and "Bij" in headers, but pdf-parse loses layout.
    // We might need to rely on the transaction type or context.
    // Actually, looking at the debug output:
    // "17-11cbNL36 INGB 0003 4455 88190,00" -> Amount 190,00? No, 88190,00?
    // Wait, "88190,00" looks like "88 190,00" or maybe the description is merged?
    // "NL36 INGB 0003 4455 88" looks like an IBAN!
    // NL36 INGB 0003 4455 88 is 18 chars.
    // So "190,00" is the amount.
    // The regex `(.*?)` is non-greedy, so it stops at the first digit that starts the amount pattern.
    // If the description contains numbers, it might be tricky.
    // But `(\d[\d\.]*,\d{2})` requires a comma.
    // Let's assume the regex holds.

    // Credit/Debit for ING:
    // ING usually lists "Af" or "Bij" explicitly in CSV, but in PDF it's positional.
    // In the debug output, we see:
    // "17-11bcAlbert Heijn 158531,41" -> Amount 31,41. "1585" part of description?
    // "Albert Heijn 1585" -> maybe store ID?
    //
    // Let's look at "17-11cbNL36 INGB 0003 4455 88190,00" again.
    // IBAN: NL36 INGB 0003 4455 88
    // Amount: 190,00
    //
    // Issue: The regex might eat the last digits of the description if they look like part of the amount?
    // Regex for date at start of line: DD-MM-YYYY
    const dateRegex = /^(\d{2}-\d{2}-\d{4})/;
    // Regex for amount on its own line or at end of line: 1.234,56
    const amountRegex = /([\d\.]+,\d{2})/;

    let i = 0;
    while (i < lines.length) {
        const line = lines[i].trim();
        const dateMatch = line.match(dateRegex);

        if (dateMatch) {
            try {
                const dateStr = dateMatch[1]; // 01-01-2025
                const date = parse(dateStr, 'dd-MM-yyyy', new Date());

                if (!isValid(date)) {
                    i++;
                    continue;
                }

                // The rest of the line is description (initially)
                let description = line.substring(dateStr.length).trim();
                let amountCents: number | null = null;

                // Check if amount is at the end of THIS line
                // e.g. "17-01-2025... 3,703,70" -> Two amounts? Or "3,70" and "3,70"?
                // Or "17-01-2025... 19,00"
                // We look for the LAST occurrence of an amount pattern
                const amountMatches = line.match(/([\d\.]+,\d{2})/g);
                if (amountMatches && amountMatches.length > 0) {
                    // If there are matches, the last one is likely the credit/debit amount
                    // But wait, if there are two amounts (Af / Bij), we need to know which one.
                    // In the sample: "3,703,70" -> "3,70" and "3,70".
                    // Usually "Af" is first? But "Bij" is second?
                    // If we assume "Af" (Debit) is the default.

                    // Let's check if the line ENDS with the amount
                    if (line.match(/[\d\.]+,\d{2}$/)) {
                        // Yes, line ends with amount.
                        // We take the last match as the amount.
                        // But we need to be careful about "Af" vs "Bij".
                        // For now, we assume Debit (-).
                        const amountStr = amountMatches[amountMatches.length - 1];
                        amountCents = -Math.abs(stringToCents(amountStr));

                        // Remove amount from description
                        // Be careful not to remove parts of description that look like amount
                        description = description.replace(amountStr, '').trim();
                        // If there was a second amount (e.g. 3,70 3,70), remove that too?
                        if (amountMatches.length > 1) {
                            const amountStr2 = amountMatches[amountMatches.length - 2];
                            description = description.replace(amountStr2, '').trim();
                        }
                    }
                }

                // If amount not found on first line, look at subsequent lines
                if (amountCents === null) {
                    let j = i + 1;
                    while (j < lines.length) {
                        const nextLine = lines[j].trim();

                        // Stop if next line is a new date
                        if (nextLine.match(dateRegex)) {
                            break;
                        }

                        // Check if this line is JUST an amount
                        // e.g. "76,00" or "1.410,00"
                        if (nextLine.match(/^[\d\.]+,\d{2}$/)) {
                            amountCents = -Math.abs(stringToCents(nextLine));
                            i = j; // Advance main loop to this line
                            break;
                        }

                        // Otherwise, it's part of description
                        description += ' ' + nextLine;
                        j++;
                        // Advance main loop to consume this description line
                        i = j - 1;
                    }
                }

                if (amountCents !== null) {
                    // Generate hash
                    // We don't have IBAN easily extracted yet, unless we parse it from description
                    let iban = '';
                    const ibanMatch = description.match(/IBAN:\s*([A-Z]{2}\d{2}[A-Z0-9]{4,})/);
                    if (ibanMatch) {
                        iban = ibanMatch[1].replace(/\s/g, '');
                    }

                    const hashData = `${date.toISOString()}_${amountCents}_${iban}_${description}`;
                    const hash = await generateTransactionHash(hashData);

                    transactions.push({
                        date,
                        amountCents,
                        description: description.trim(),
                        counterpartyName: description.split('Naam:')[1]?.split('Omschrijving:')[0]?.trim() || '',
                        counterpartyIban: iban,
                        importHash: hash,
                    });
                } else {
                    // Could not find amount for this date, maybe it's not a transaction line?
                    // e.g. "Periode01-01-2025 t/m ..."
                    // We just ignore it.
                }

            } catch (e) {
                console.error('Error parsing ING line:', line, e);
                errors.push(`Error parsing line: ${line}`);
            }
        }
        i++;
    }
    if (transactions.length === 0) {
        errors.push('Geen transacties gevonden in ING PDF.');
    }
}
