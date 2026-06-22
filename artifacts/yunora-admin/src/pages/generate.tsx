import React, { useState } from 'react';
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
} from '@workspace/api-client-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Sparkles } from 'lucide-react';

const DIFFICULTY_LEVELS = [
  { value: 'easy',     label: 'Easy',     description: 'Basic recall & understanding',         color: 'bg-green-100 text-green-800 border-green-200' },
  { value: 'medium',   label: 'Medium',   description: 'Conceptual & application-based',        color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  { value: 'hard',     label: 'Hard',     description: 'Deep reasoning & multi-step HOTS',      color: 'bg-orange-100 text-orange-800 border-orange-200' },
  { value: 'advanced', label: 'Advanced', description: 'Very hard — olympiad / competitive level', color: 'bg-red-100 text-red-800 border-red-200' },
] as const;

type DifficultyValue = typeof DIFFICULTY_LEVELS[number]['value'];

const baseSchema = z.object({
  boardId: z.coerce.number().min(1, { message: "Required" }),
  standardId: z.coerce.number().min(1, { message: "Required" }),
  subjectId: z.coerce.number().min(1, { message: "Required" }),
  chapterId: z.coerce.number().min(1, { message: "Required" }),
  topicId: z.coerce.number().min(1, { message: "Required" }),
  questionType: z.string().min(1, { message: "Required" }),
  providerId: z.coerce.number().min(1, { message: "Required" }),
  model: z.string().min(1, { message: "Required" }),
});

type BaseFormValues = z.infer<typeof baseSchema>;

export default function GeneratePage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const form = useForm<BaseFormValues>({
    resolver: zodResolver(baseSchema),
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

  // Multi-difficulty state: selected difficulties with per-level counts
  const [diffCounts, setDiffCounts] = useState<Partial<Record<DifficultyValue, number>>>({ medium: 5 });

  const toggleDifficulty = (val: DifficultyValue) => {
    setDiffCounts(prev => {
      const next = { ...prev };
      if (next[val] !== undefined) {
        delete next[val];
      } else {
        next[val] = 5;
      }
      return next;
    });
  };

  const setCount = (val: DifficultyValue, n: number) => {
    setDiffCounts(prev => ({ ...prev, [val]: Math.max(1, Math.min(50, n)) }));
  };

  const selectedDifficulties = Object.keys(diffCounts) as DifficultyValue[];
  const totalQuestions = selectedDifficulties.reduce((sum, d) => sum + (diffCounts[d] ?? 0), 0);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async (data: BaseFormValues) => {
    if (selectedDifficulties.length === 0) {
      toast({ variant: 'destructive', title: 'Select at least one difficulty level' });
      return;
    }

    setIsSubmitting(true);
    const jobIds: string[] = [];
    const errors: string[] = [];

    for (const difficulty of selectedDifficulties) {
      const count = diffCounts[difficulty] ?? 5;
      try {
        const res = await generateMutation.mutateAsync({ data: { ...data, difficulty, count } });
        jobIds.push(res.jobId);
      } catch (err) {
        errors.push(`${difficulty}: ${(err as Error).message}`);
      }
    }

    setIsSubmitting(false);

    if (jobIds.length > 0) {
      toast({
        title: `${jobIds.length} Generation Job${jobIds.length > 1 ? 's' : ''} Started`,
        description: `Generating ${totalQuestions} questions across ${jobIds.length} difficulty level${jobIds.length > 1 ? 's' : ''}.`,
      });
      setLocation('/jobs');
    }
    if (errors.length > 0) {
      toast({
        variant: 'destructive',
        title: 'Some jobs failed to start',
        description: errors.join('\n'),
      });
    }
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

              {/* Curriculum hierarchy */}
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

              {/* Question type */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="questionType"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
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
              </div>

              <div className="h-px w-full bg-border" />

              {/* Multi-difficulty selection */}
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium leading-none">Difficulty Levels</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Select one or more levels. Each level starts its own generation job.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {DIFFICULTY_LEVELS.map((lvl) => {
                    const isSelected = diffCounts[lvl.value] !== undefined;
                    return (
                      <div
                        key={lvl.value}
                        onClick={() => toggleDifficulty(lvl.value)}
                        className={`rounded-lg border-2 p-4 cursor-pointer transition-all select-none ${
                          isSelected
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/40 hover:bg-muted/30'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleDifficulty(lvl.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="mt-0.5"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm">{lvl.label}</span>
                              <Badge variant="outline" className={`text-xs ${lvl.color}`}>
                                {lvl.value === 'advanced' ? 'Very Hard' : lvl.label}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{lvl.description}</p>

                            {isSelected && (
                              <div
                                className="mt-3 flex items-center gap-2"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <label className="text-xs text-muted-foreground whitespace-nowrap">Questions:</label>
                                <Input
                                  type="number"
                                  min={1}
                                  max={50}
                                  value={diffCounts[lvl.value] ?? 5}
                                  onChange={(e) => setCount(lvl.value, parseInt(e.target.value) || 1)}
                                  className="w-20 h-7 text-sm"
                                />
                                <span className="text-xs text-muted-foreground">(max 50)</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {selectedDifficulties.length > 0 && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground pt-1">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    <span>
                      Will generate <strong className="text-foreground">{totalQuestions} questions</strong> across{' '}
                      <strong className="text-foreground">{selectedDifficulties.length}</strong> job{selectedDifficulties.length > 1 ? 's' : ''}
                      {' '}({selectedDifficulties.map(d => DIFFICULTY_LEVELS.find(l => l.value === d)?.label).join(', ')})
                    </span>
                  </div>
                )}
              </div>

              <div className="h-px w-full bg-border" />

              {/* AI Provider */}
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

            <CardFooter className="bg-muted/50 border-t px-6 py-4 flex items-center gap-4">
              <Button
                type="submit"
                disabled={isSubmitting || selectedDifficulties.length === 0}
                className="w-full md:w-auto"
              >
                {isSubmitting ? 'Starting Jobs…' : (
                  <><Sparkles className="mr-2 h-4 w-4" />
                    Start Generation
                    {selectedDifficulties.length > 1 ? ` (${selectedDifficulties.length} Jobs)` : ''}
                  </>
                )}
              </Button>
              {selectedDifficulties.length === 0 && (
                <p className="text-xs text-muted-foreground">Select at least one difficulty level above.</p>
              )}
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
}
