import React, { useState } from 'react';
import { 
  useListPapers,
  useCreatePaper,
  useExportPaper,
  getListPapersQueryKey,
  useListQuestions
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { FileText, Download, Plus, Loader2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function PapersPage() {
  const { data, isLoading } = useListPapers();
  const exportPaper = useExportPaper();
  const { toast } = useToast();
  const [exportingId, setExportingId] = useState<number | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const handleExport = (id: number) => {
    setExportingId(id);
    exportPaper.mutate({ data: { paperId: id } }, {
      onSuccess: (res) => {
        if (res.success && res.downloadUrl) {
          window.open(res.downloadUrl, '_blank');
          toast({ title: 'Export started', description: 'Your PDF is downloading.' });
        } else {
          toast({ variant: 'destructive', title: 'Export failed' });
        }
        setExportingId(null);
      },
      onError: (err) => {
        toast({ variant: 'destructive', title: 'Export failed', description: err.message });
        setExportingId(null);
      }
    });
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Papers</h1>
          <p className="text-muted-foreground">Assemble questions into ready-to-print exam papers.</p>
        </div>
        
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <SheetTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Create Paper</Button>
          </SheetTrigger>
          <SheetContent side="right" className="sm:max-w-2xl w-[90vw] overflow-hidden flex flex-col p-0">
            <SheetHeader className="px-6 py-4 border-b">
              <SheetTitle>Create Exam Paper</SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-auto p-6">
              <CreatePaperForm onSuccess={() => setIsSheetOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Institution</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Questions</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.data.map((paper) => (
                <TableRow key={paper.id}>
                  <TableCell className="font-medium">{paper.title}</TableCell>
                  <TableCell>{paper.institutionName}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {paper.boardName} {paper.standardName && `> ${paper.standardName}`} {paper.subjectName && `> ${paper.subjectName}`}
                  </TableCell>
                  <TableCell>{paper.totalQuestions}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(parseISO(paper.createdAt), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleExport(paper.id)}
                      disabled={exportingId === paper.id}
                    >
                      {exportingId === paper.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
                      Export PDF
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {(!data?.data || data.data.length === 0) && !isLoading && (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center">
                      <FileText className="h-8 w-8 text-muted-foreground mb-2 opacity-50" />
                      <p>No papers generated yet.</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

const createPaperSchema = z.object({
  title: z.string().min(1, "Title is required"),
  institutionName: z.string().optional(),
  includeAnswerKey: z.boolean().default(true),
  includeExplanations: z.boolean().default(false),
});

type CreatePaperValues = z.infer<typeof createPaperSchema>;

function CreatePaperForm({ onSuccess }: { onSuccess: () => void }) {
  const createPaper = useCreatePaper();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  // Hardcoded to fetch 50 questions for demo. Ideally this would be paginated and filterable.
  const { data: questionsData } = useListQuestions({ limit: 50 });
  const [selectedQuestions, setSelectedQuestions] = useState<number[]>([]);

  const form = useForm<CreatePaperValues>({
    resolver: zodResolver(createPaperSchema),
    defaultValues: {
      title: '',
      institutionName: '',
      includeAnswerKey: true,
      includeExplanations: false
    }
  });

  const onSubmit = (data: CreatePaperValues) => {
    if (selectedQuestions.length === 0) {
      toast({ variant: "destructive", title: "Select questions", description: "You must select at least one question." });
      return;
    }

    createPaper.mutate({ 
      data: {
        ...data,
        questionIds: selectedQuestions
      } 
    }, {
      onSuccess: () => {
        toast({ title: "Paper created successfully" });
        queryClient.invalidateQueries({ queryKey: getListPapersQueryKey() });
        onSuccess();
      },
      onError: (err) => {
        toast({ variant: "destructive", title: "Error creating paper", description: err.message });
      }
    });
  };

  const toggleQuestion = (id: number) => {
    setSelectedQuestions(prev => 
      prev.includes(id) ? prev.filter(qId => qId !== id) : [...prev, id]
    );
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 flex flex-col h-full">
        <div className="space-y-4 flex-none">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Paper Title</FormLabel>
                <FormControl><Input placeholder="e.g. Midterm Examination 2024" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="institutionName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Institution Name (Optional)</FormLabel>
                <FormControl><Input placeholder="e.g. Springfield High School" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex-1 min-h-[300px] flex flex-col border rounded-md overflow-hidden">
          <div className="bg-muted p-2 border-b font-medium text-sm flex justify-between items-center">
            <span>Select Questions ({selectedQuestions.length} selected)</span>
          </div>
          <ScrollArea className="flex-1 p-2">
            <div className="space-y-2">
              {questionsData?.data.map(q => (
                <div key={q.id} className="flex items-start space-x-3 p-3 border rounded-md hover:bg-muted/50">
                  <Checkbox 
                    id={`q-${q.id}`} 
                    checked={selectedQuestions.includes(q.id)}
                    onCheckedChange={() => toggleQuestion(q.id)}
                  />
                  <div className="space-y-1 leading-none">
                    <label htmlFor={`q-${q.id}`} className="text-sm font-medium cursor-pointer">
                      {q.question}
                    </label>
                    <p className="text-xs text-muted-foreground mt-1">
                      {q.subjectName} • {q.difficulty} • Score: {q.qualityScore}/10
                    </p>
                  </div>
                </div>
              ))}
              {(!questionsData?.data || questionsData.data.length === 0) && (
                <div className="text-center p-4 text-muted-foreground text-sm">No questions available to select.</div>
              )}
            </div>
          </ScrollArea>
        </div>

        <div className="flex space-x-4 flex-none">
          <FormField
            control={form.control}
            name="includeAnswerKey"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow-sm flex-1">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>Include Answer Key</FormLabel>
                  <CardDescription className="text-xs">Append answers at the end.</CardDescription>
                </div>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="includeExplanations"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow-sm flex-1">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>Include Explanations</FormLabel>
                  <CardDescription className="text-xs">Add detailed explanations to answers.</CardDescription>
                </div>
              </FormItem>
            )}
          />
        </div>

        <Button type="submit" className="w-full mt-4 flex-none" disabled={createPaper.isPending}>
          {createPaper.isPending ? "Creating..." : "Create Paper"}
        </Button>
      </form>
    </Form>
  );
}
