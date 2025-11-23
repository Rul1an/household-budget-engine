import { openai } from '@ai-sdk/openai';
import { streamObject } from 'ai';
import { z } from 'zod';

// Definieer wat we verwachten van de AI
const AdviceSchema = z.object({
    analysis: z.string(),
    savingsTips: z.array(z.object({
        title: z.string(),
        potentialSaveAmount: z.number(),
    })),
});

export async function getFinancialAdvice(contextData: any) {
    'use server';

    const result = await streamObject({
        model: openai('gpt-4o'),
        schema: AdviceSchema,
        prompt: `
      You are a strictly analytical financial assistant. You will receive a JSON summary of a household's monthly average finances.

      Your Rules:
      Do not calculate totals yourself; trust the values in the JSON.
      Do not invent taxes, interest rates, or advice that is not present in the data.
      Your goal is to explain the 'Net needed from partners' in simple terms: (Fixed Costs minus Allowances).

      Data: ${JSON.stringify(contextData)}
    `,
    });

    return result.toTextStreamResponse();
}
