import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
import { env } from '../../env';

// Define the schema for the categorization result
const categorizationSchema = z.object({
    category: z.enum([
        'Boodschappen',
        'Huur/Hypotheek',
        'Energie',
        'Water',
        'Verzekeringen',
        'Internet/TV',
        'Mobiel',
        'Vervoer',
        'Uitgaan',
        'Kleding',
        'Persoonlijke verzorging',
        'Huishouden',
        'Cadeaus',
        'Goede doelen',
        'Sparen',
        'Overige',
        'Salaris',
        'Toeslagen',
        'Teruggave',
    ]),
    confidence: z.number().min(0).max(1),
    reasoning: z.string(),
});

export type CategorizationResult = z.infer<typeof categorizationSchema>;

export async function categorizeTransaction(
    description: string,
    amount: number,
    counterparty?: string
): Promise<CategorizationResult | null> {
    if (!env.OPENAI_API_KEY) {
        console.warn('OPENAI_API_KEY not set, skipping AI categorization');
        return null;
    }

    try {
        const { object } = await generateObject({
            model: openai('gpt-4o'),
            schema: categorizationSchema,
            prompt: `Categorize the following bank transaction into one of the predefined categories.

      Transaction Details:
      - Description: "${description}"
      - Amount: ${amount} EUR
      - Counterparty: "${counterparty || 'Unknown'}"

      Context:
      - Negative amounts are usually expenses.
      - Positive amounts are usually income (Salaris, Toeslagen, Teruggave).
      - "Albert Heijn", "Jumbo", "Lidl" are usually "Boodschappen".
      - "Shell", "Esso", "NS" are usually "Vervoer".
      - "Ziggo", "KPN" are usually "Internet/TV" or "Mobiel".

      Provide the most likely category, a confidence score (0-1), and a brief reasoning.`,
        });

        return object;
    } catch (error) {
        console.error('Error categorizing transaction:', error);
        return null;
    }
}
