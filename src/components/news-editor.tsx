"use client";

import * as React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Image from 'next/image';

import type { NewsArticle } from '@/types';
import { suggestAlternativeTitles, SuggestAlternativeTitlesInput } from '@/ai/flows/suggest-alternative-titles';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { NewsPreview } from './news-preview';
import { Loader2, Sparkles, Send, RotateCcw } from 'lucide-react';

const newsArticleSchema = z.object({
  title: z.string().min(5, { message: "Title must be at least 5 characters." }).max(150, { message: "Title must be 150 characters or less." }),
  text: z.string().min(20, { message: "Article text must be at least 20 characters." }),
  imageUrl: z.string().url({ message: "Please enter a valid image URL." }).or(z.literal("").transform(() => "https://placehold.co/600x400.png")), // Default to placeholder if empty
  isFeatured: z.boolean().default(false),
});

type NewsArticleFormValues = z.infer<typeof newsArticleSchema>;

export function NewsEditor() {
  const { toast } = useToast();
  const [suggestedTitles, setSuggestedTitles] = React.useState<string[]>([]);
  const [isSuggestingTitles, setIsSuggestingTitles] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<NewsArticleFormValues>({
    resolver: zodResolver(newsArticleSchema),
    defaultValues: {
      title: '',
      text: '',
      imageUrl: '',
      isFeatured: false,
    },
    mode: "onChange", // useful for live preview updates
  });

  const watchedTitle = form.watch('title');
  const watchedText = form.watch('text');
  const watchedImageUrl = form.watch('imageUrl');
  const watchedIsFeatured = form.watch('isFeatured');

  const handleSuggestTitles = async () => {
    const currentTitle = form.getValues('title');
    const currentText = form.getValues('text');

    if (!currentText || currentText.length < 20) {
      toast({
        title: "Content too short",
        description: "Please write at least 20 characters in the article text before suggesting titles.",
        variant: "destructive",
      });
      return;
    }

    setIsSuggestingTitles(true);
    setSuggestedTitles([]);
    try {
      const input: SuggestAlternativeTitlesInput = {
        articleTitle: currentTitle || "Untitled Article", // Provide a fallback if title is empty
        articleContent: currentText,
      };
      const result = await suggestAlternativeTitles(input);
      setSuggestedTitles(result.alternativeTitles);
      if (result.alternativeTitles.length === 0) {
        toast({
          title: "No suggestions",
          description: "The AI couldn't generate alternative titles at this time. Try refining your article text.",
        });
      }
    } catch (error) {
      console.error("Error suggesting titles:", error);
      toast({
        title: "Error",
        description: "Failed to suggest titles. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSuggestingTitles(false);
    }
  };

  const onSubmit = async (data: NewsArticleFormValues) => {
    setIsSubmitting(true);
    console.log("Simulated submission data:", data);

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));

    toast({
      title: "Article Submitted!",
      description: "Your news article has been 'saved' (simulated).",
    });
    // form.reset(); // Optionally reset form
    // setSuggestedTitles([]); // Clear suggestions
    setIsSubmitting(false);
  };
  
  const resetFormAndPreview = () => {
    form.reset({
      title: '',
      text: '',
      imageUrl: '',
      isFeatured: false,
    });
    setSuggestedTitles([]);
    toast({
      title: "Form Reset",
      description: "The editor and preview have been cleared.",
    });
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <header className="mb-8 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-primary">NewsFlash Editor</h1>
        <p className="text-muted-foreground mt-2">Craft compelling news stories with AI-powered assistance.</p>
      </header>

      <div className="grid lg:grid-cols-2 gap-8 items-start">
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle>Article Editor</CardTitle>
            <CardDescription>Fill in the details for your news article.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter article title" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="text"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Article Text</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Write your news article here..." {...field} rows={10} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="imageUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Image URL</FormLabel>
                      <FormControl>
                        <Input placeholder="https://example.com/image.png" {...field} 
                         onChange={e => field.onChange(e.target.value === "" ? "" : e.target.value)} // Ensure empty string is passed if cleared
                        />
                      </FormControl>
                       <FormDescription>
                        Enter a valid URL for the article image. Leave empty for a default placeholder.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {watchedImageUrl && watchedImageUrl !== 'https://placehold.co/600x400.png' && (
                  <div className="relative w-full max-w-xs h-32 rounded-md overflow-hidden border">
                     <Image src={watchedImageUrl} alt="Current Image URL Preview" layout="fill" objectFit="cover" onError={(e) => e.currentTarget.src = 'https://placehold.co/600x400.png'} data-ai-hint="thumbnail image"/>
                  </div>
                )}


                <FormField
                  control={form.control}
                  name="isFeatured"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                      <div className="space-y-0.5">
                        <FormLabel>Featured Article</FormLabel>
                        <FormDescription>
                          Mark this article as featured.
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="space-y-4">
                  <Button type="button" onClick={handleSuggestTitles} disabled={isSuggestingTitles || watchedText.length < 20} className="w-full sm:w-auto">
                    {isSuggestingTitles ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="mr-2 h-4 w-4" />
                    )}
                    Suggest Titles
                  </Button>

                  {suggestedTitles.length > 0 && (
                    <div className="space-y-2 p-3 border rounded-md bg-secondary/50">
                      <h4 className="font-semibold text-sm text-secondary-foreground">Alternative Titles:</h4>
                      <ul className="list-disc list-inside space-y-1">
                        {suggestedTitles.map((title, index) => (
                          <li key={index} className="text-sm text-secondary-foreground/90">
                            <Button
                              variant="link"
                              size="sm"
                              className="p-0 h-auto text-left text-primary hover:underline"
                              onClick={() => form.setValue('title', title, { shouldValidate: true })}
                            >
                              {title}
                            </Button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                
                <div className="flex flex-col sm:flex-row gap-2 pt-4">
                  <Button type="submit" disabled={isSubmitting} className="flex-1">
                    {isSubmitting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                       <Send className="mr-2 h-4 w-4" />
                    )}
                    Submit Article
                  </Button>
                   <Button type="button" variant="outline" onClick={resetFormAndPreview} className="flex-1 sm:flex-none">
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Reset Form
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        <div className="sticky top-8">
          <CardHeader className="px-0 pt-0 lg:px-4">
            <CardTitle>Live Preview</CardTitle>
            <CardDescription>See your article take shape in real-time.</CardDescription>
          </CardHeader>
          <NewsPreview
            title={watchedTitle}
            text={watchedText}
            imageUrl={watchedImageUrl || 'https://placehold.co/600x400.png'} // Pass placeholder if empty
            isFeatured={watchedIsFeatured}
          />
        </div>
      </div>
    </div>
  );
}
