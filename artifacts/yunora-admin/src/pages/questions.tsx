import React, { useState } from 'react';
import { 
  useListQuestions,
  useDeleteQuestion,
  getListQuestionsQueryKey
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Search, Trash2, Edit, FileDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';

export default function QuestionsPage() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  // Basic debounce implementation for search
  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 500);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading } = useListQuestions({ search: debouncedSearch });
  const deleteQuestion = useDeleteQuestion();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleDelete = (id: number) => {
    if (confirm("Delete this question?")) {
      deleteQuestion.mutate({ id }, {
        onSuccess: () => {
          toast({ title: 'Question deleted' });
          queryClient.invalidateQueries({ queryKey: getListQuestionsQueryKey() });
        }
      });
    }
  };

  const getDifficultyColor = (diff: string) => {
    switch(diff) {
      case 'easy': return 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20';
      case 'medium': return 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20';
      case 'hard': return 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20';
      default: return '';
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Question Library</h1>
          <p className="text-muted-foreground">Browse, edit, and curate generated questions.</p>
        </div>
        <div className="w-full md:w-72 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search questions..." 
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      ) : data?.data && data.data.length > 0 ? (
        <div className="space-y-4">
          <Accordion type="single" collapsible className="w-full space-y-4">
            {data.data.map((q) => (
              <AccordionItem key={q.id} value={`q-${q.id}`} className="border rounded-lg bg-card px-4 shadow-sm">
                <AccordionTrigger className="hover:no-underline py-4">
                  <div className="flex flex-col items-start text-left gap-2 w-full pr-4">
                    <div className="flex items-center gap-2 w-full">
                      <Badge variant="outline" className={getDifficultyColor(q.difficulty)}>
                        {q.difficulty.toUpperCase()}
                      </Badge>
                      <Badge variant="outline">{q.questionType}</Badge>
                      <span className="text-xs text-muted-foreground ml-auto whitespace-nowrap">
                        {q.subjectName} • {q.chapterName}
                      </span>
                    </div>
                    <span className="font-medium text-base line-clamp-2">{q.question}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-2 pb-4 border-t">
                  <div className="space-y-4">
                    {q.options && (
                      <div>
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Options</h4>
                        <div className="bg-muted/50 p-3 rounded-md text-sm whitespace-pre-wrap">
                          {q.options}
                        </div>
                      </div>
                    )}
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Correct Answer</h4>
                      <div className="bg-primary/5 text-primary border border-primary/10 p-3 rounded-md text-sm font-medium">
                        {q.correctAnswer}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Explanation</h4>
                      <div className="text-sm text-muted-foreground">
                        {q.explanation}
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center justify-between pt-4 gap-4">
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span title="Quality Score">Score: {q.qualityScore}/10</span>
                        <span>Model: {q.modelUsed}</span>
                        <span>{q.generatedAt ? format(parseISO(q.generatedAt), 'MMM d, yyyy') : ''}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm"><Edit className="h-4 w-4 mr-2" /> Edit</Button>
                        <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => handleDelete(q.id)}><Trash2 className="h-4 w-4 mr-2" /> Delete</Button>
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      ) : (
        <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <Search className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold">No questions found</h3>
          <p className="text-muted-foreground max-w-sm mt-2 mb-6">
            We couldn't find any questions matching your search. Try adjusting your filters or generating new ones.
          </p>
          <Button variant="outline" onClick={() => setSearch('')}>Clear search</Button>
        </Card>
      )}
    </div>
  );
}
