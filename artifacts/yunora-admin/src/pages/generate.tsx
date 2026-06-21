import React from 'react';
import { useLocation } from 'wouter';
import { 
  useListBoards, 
  useListStandards, 
  useListSubjects, 
  useListChapters, 
  useListTopics,
  useListAiProviders,
  useListQuestionTypes,
  useStartGeneration,
  GenerationRequestDifficulty
} from '@workspace/api-client-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Sparkles } from 'lucide-react';

const generateSchema = z.object({
  boardId: z.coerce.number().min(1, { message: "Required" }),
  standardId: z.coerce.number().min(1, { message: "Required" }),
  subjectId: z.coerce.number().min(1, { message: "Required" }),
  chapterId: z.coerce.number().min(1, { message: "Required" }),
  topicId: z.coerce.number().min(1, { message: "Required" }),
  questionType: z.string().min(1, { message: "Required" }),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  count: z.coerce.number().min(1).max(50),
  providerId: z.coerce.number().min(1, { message: "Required" }),
  model: z.string().min(1, { message: "Required" }),
});

type GenerateFormValues = z.infer<typeof generateSchema>;

export default function GeneratePage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const form = useForm<GenerateFormValues>({
    resolver: zodResolver(generateSchema),
    defaultValues: {
      difficulty: 'medium',
      count: 5,
    },
  });

  const boardId = form.watch('boardId');
  const standardId = form.watch('standardId');
  const subjectId = form.watch('subjectId');
  const chapterId = form.watch('chapterId');
  const providerId = form.watch('providerId');

  const { data: boards } = useListBoards();
  const { data: standards } = useListStandards({ boardId });
  const { data: subjects } = useListSubjects({ standardId });
  const { data: chapters } = useListChapters({ subjectId });
  const { data: topics } = useListTopics({ chapterId });
  const { data: providers } = useListAiProviders();
  const { data: questionTypes } = useListQuestionTypes();

  const selectedProvider = providers?.find(p => p.id === Number(providerId));

  const generateMutation = useStartGeneration();

  const onSubmit = (data: GenerateFormValues) => {
    generateMutation.mutate({ data }, {
      onSuccess: (res) => {
        toast({
          title: "Generation Job Started",
          description: `Job ID: ${res.jobId}`,
        });
        setLocation(`/jobs`); // redirect to jobs to watch progress
      },
      onError: (err) => {
        toast({
          variant: "destructive",
          title: "Failed to start generation",
          description: err.message,
        });
      }
    });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Generate Questions</h1>
        <p className="text-muted-foreground">Configure AI parameters and generate new curriculum content.</p>
      </div>

      <Card>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardHeader>
              <CardTitle>Configuration Wizard</CardTitle>
              <CardDescription>Select the target topic and generation parameters.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="boardId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Board</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value?.toString()}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Select board" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {boards?.data.map((b) => (
                            <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="standardId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Standard</FormLabel>
                      <Select disabled={!boardId} onValueChange={field.onChange} value={field.value?.toString()}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Select standard" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {standards?.data.map((s) => (
                            <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="subjectId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subject</FormLabel>
                      <Select disabled={!standardId} onValueChange={field.onChange} value={field.value?.toString()}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {subjects?.data.map((s) => (
                            <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="chapterId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Chapter</FormLabel>
                      <Select disabled={!subjectId} onValueChange={field.onChange} value={field.value?.toString()}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Select chapter" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {chapters?.data.map((c) => (
                            <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="topicId"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Topic</FormLabel>
                      <Select disabled={!chapterId} onValueChange={field.onChange} value={field.value?.toString()}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Select topic" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {topics?.data.map((t) => (
                            <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="h-px w-full bg-border" />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="questionType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Question Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {questionTypes?.map((q) => (
                            <SelectItem key={q.id} value={q.slug}>{q.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="difficulty"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Difficulty</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Select difficulty" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="easy">Easy</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="hard">Hard</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="count"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quantity</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} max={50} {...field} />
                      </FormControl>
                      <FormDescription>Max 50 questions per job.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="h-px w-full bg-border" />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="providerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>AI Provider</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value?.toString()}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Select provider" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {providers?.map((p) => (
                            <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="model"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Model</FormLabel>
                      <Select disabled={!providerId} onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Select model" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {selectedProvider?.availableModels?.map((m) => (
                            <SelectItem key={m} value={m}>{m}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
            <CardFooter className="bg-muted/50 border-t px-6 py-4">
              <Button type="submit" disabled={generateMutation.isPending} className="w-full md:w-auto">
                {generateMutation.isPending ? "Starting..." : (
                  <><Sparkles className="mr-2 h-4 w-4" /> Start Generation</>
                )}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
}
