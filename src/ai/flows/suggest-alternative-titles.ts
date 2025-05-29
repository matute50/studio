// src/ai/flows/suggest-alternative-titles.ts
'use server';
/**
 * @fileOverview Un flujo para generar títulos alternativos para un artículo de noticias.
 *
 * - suggestAlternativeTitles - Una función que genera títulos alternativos para un artículo de noticias.
 * - SuggestAlternativeTitlesInput - El tipo de entrada para la función suggestAlternativeTitles.
 * - SuggestAlternativeTitlesOutput - El tipo de retorno para la función suggestAlternativeTitles.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestAlternativeTitlesInputSchema = z.object({
  articleTitle: z.string().describe('El título actual del artículo de noticias.'),
  articleContent: z.string().describe('El contenido del artículo de noticias.'),
});
export type SuggestAlternativeTitlesInput = z.infer<typeof SuggestAlternativeTitlesInputSchema>;

const SuggestAlternativeTitlesOutputSchema = z.object({
  alternativeTitles: z.array(z.string()).describe('Un array de títulos alternativos para el artículo de noticias.'),
});
export type SuggestAlternativeTitlesOutput = z.infer<typeof SuggestAlternativeTitlesOutputSchema>;

export async function suggestAlternativeTitles(input: SuggestAlternativeTitlesInput): Promise<SuggestAlternativeTitlesOutput> {
  return suggestAlternativeTitlesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestAlternativeTitlesPrompt',
  input: {schema: SuggestAlternativeTitlesInputSchema},
  output: {schema: SuggestAlternativeTitlesOutputSchema},
  prompt: `Eres un editor de noticias profesional. Tu tarea es sugerir títulos alternativos para un artículo de noticias en español.

  El título actual del artículo es: {{{articleTitle}}}
  El contenido del artículo es: {{{articleContent}}}

  Sugiere 5 títulos alternativos en español que sean atractivos y relevantes para el contenido del artículo.
  Devuelve los títulos como un array JSON de strings.
  Asegúrate de que los títulos generados sean apropiados para una audiencia general de habla hispana.
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
    // Ensure we return an empty array if output or alternativeTitles is undefined
    return output && output.alternativeTitles ? output : { alternativeTitles: [] };
  }
);
