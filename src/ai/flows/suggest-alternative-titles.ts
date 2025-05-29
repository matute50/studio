// src/ai/flows/suggest-alternative-titles.ts
'use server';
/**
 * @fileOverview A flow for generating alternative titles for a news article.
 *
 * - suggestAlternativeTitles - A function that generates alternative titles for a news article.
 * - SuggestAlternativeTitlesInput - The input type for the suggestAlternativeTitles function.
 * - SuggestAlternativeTitlesOutput - The return type for the suggestAlternativeTitles function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestAlternativeTitlesInputSchema = z.object({
  articleTitle: z.string().describe('The current title of the news article.'),
  articleContent: z.string().describe('The content of the news article.'),
});
export type SuggestAlternativeTitlesInput = z.infer<typeof SuggestAlternativeTitlesInputSchema>;

const SuggestAlternativeTitlesOutputSchema = z.object({
  alternativeTitles: z.array(z.string()).describe('An array of alternative titles for the news article.'),
});
export type SuggestAlternativeTitlesOutput = z.infer<typeof SuggestAlternativeTitlesOutputSchema>;

export async function suggestAlternativeTitles(input: SuggestAlternativeTitlesInput): Promise<SuggestAlternativeTitlesOutput> {
  return suggestAlternativeTitlesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestAlternativeTitlesPrompt',
  input: {schema: SuggestAlternativeTitlesInputSchema},
  output: {schema: SuggestAlternativeTitlesOutputSchema},
  prompt: `You are a professional news editor. Your task is to suggest alternative titles for a news article.

  The current title of the article is: {{{articleTitle}}}
  The content of the article is: {{{articleContent}}}

  Suggest 5 alternative titles that are engaging and relevant to the article content.
  Return the titles as a JSON array of strings.
  Make sure that the generated titles are appropriate for a general audience.
  `,
});

const suggestAlternativeTitlesFlow = ai.defineFlow(
  {
    name: 'suggestAlternativeTitlesFlow',
    inputSchema: SuggestAlternativeTitlesInputSchema,
    outputSchema: SuggestAlternativeTitlesOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
