import React, { useState } from 'react';
import { 
  useListBoards, 
  useListStandards, 
  useListSubjects, 
  useListChapters, 
  useListTopics,
  useListAiProviders,
  useCreateBoard,
  useDeleteBoard,
  useCreateStandard,
  useDeleteStandard,
  useCreateSubject,
  useDeleteSubject,
  useCreateChapter,
  useDeleteChapter,
  useCreateTopic,
  useDeleteTopic,
  getListBoardsQueryKey,
  getListStandardsQueryKey,
  getListSubjectsQueryKey,
  getListChaptersQueryKey,
  getListTopicsQueryKey,
} from '@workspace/api-client-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/hooks/use-auth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, Edit, Loader2, Sparkles, CheckCircle2, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { format, parseISO } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';

interface AiTopic {
  name: string;
  description: string;
}

export default function HierarchyPage() {
  const [activeTab, setActiveTab] = useState('boards');
  const [selectedBoardId, setSelectedBoardId] = useState<number | undefined>();
  const [selectedStandardId, setSelectedStandardId] = useState<number | undefined>();
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | undefined>();
  const [selectedChapterId, setSelectedChapterId] = useState<number | undefined>();

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Educational Hierarchy</h1>
        <p className="text-muted-foreground">Manage the structural backbone of your curriculum.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted">
          <TabsTrigger value="boards">Boards</TabsTrigger>
          <TabsTrigger value="standards">Standards</TabsTrigger>
          <TabsTrigger value="subjects">Subjects</TabsTrigger>
          <TabsTrigger value="chapters">Chapters</TabsTrigger>
          <TabsTrigger value="topics">Topics</TabsTrigger>
        </TabsList>

        <TabsContent value="boards" className="space-y-4">
          <BoardsTab onSelectBoard={(id) => { setSelectedBoardId(id); setActiveTab('standards'); }} />
        </TabsContent>
        
        <TabsContent value="standards" className="space-y-4">
          <StandardsTab boardId={selectedBoardId} onSelectStandard={(id) => { setSelectedStandardId(id); setActiveTab('subjects'); }} />
        </TabsContent>
        
        <TabsContent value="subjects" className="space-y-4">
          <SubjectsTab standardId={selectedStandardId} onSelectSubject={(id) => { setSelectedSubjectId(id); setActiveTab('chapters'); }} />
        </TabsContent>
        
        <TabsContent value="chapters" className="space-y-4">
          <ChaptersTab subjectId={selectedSubjectId} onSelectChapter={(id) => { setSelectedChapterId(id); setActiveTab('topics'); }} />
        </TabsContent>
        
        <TabsContent value="topics" className="space-y-4">
          <TopicsTab chapterId={selectedChapterId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BoardsTab({ onSelectBoard }: { onSelectBoard: (id: number) => void }) {
  const { data, isLoading } = useListBoards();
  const deleteBoard = useDeleteBoard();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleDelete = (id: number) => {
    deleteBoard.mutate({ id }, {
      onSuccess: () => {
        toast({ title: 'Board deleted' });
        queryClient.invalidateQueries({ queryKey: getListBoardsQueryKey() });
      },
      onError: (err) => {
        toast({ variant: 'destructive', title: 'Failed to delete board', description: err.message });
      }
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Boards</CardTitle>
          <CardDescription>Top-level educational bodies. Click a board to drill into its standards.</CardDescription>
        </div>
        <Button size="sm"><Plus className="mr-2 h-4 w-4" /> Add Board</Button>
      </CardHeader>
      <CardContent>
        {isLoading ? <Skeleton className="h-64 w-full" /> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.data.map((board) => (
                <TableRow key={board.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onSelectBoard(board.id)}>
                  <TableCell className="font-mono text-xs">{board.code}</TableCell>
                  <TableCell className="font-medium flex items-center gap-2">{board.name} <ChevronRight className="h-4 w-4 text-muted-foreground" /></TableCell>
                  <TableCell><Badge variant={board.isActive ? 'default' : 'secondary'}>{board.isActive ? 'Active' : 'Inactive'}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">{board.createdAt ? format(parseISO(board.createdAt), 'MMM d, yyyy') : '-'}</TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon"><Edit className="h-4 w-4" /></Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                          <AlertDialogDescription>This will permanently delete the board and all nested data.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(board.id)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
              {(!data?.data || data.data.length === 0) && (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No boards found.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function StandardsTab({ boardId, onSelectStandard }: { boardId?: number, onSelectStandard: (id: number) => void }) {
  const { data, isLoading } = useListStandards({ boardId });
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Standards</CardTitle>
          <CardDescription>Grade levels. Click to see its subjects.</CardDescription>
        </div>
        <Button size="sm"><Plus className="mr-2 h-4 w-4" /> Add Standard</Button>
      </CardHeader>
      <CardContent>
        {isLoading ? <Skeleton className="h-64 w-full" /> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Level</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Board</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.data.map((item) => (
                <TableRow key={item.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onSelectStandard(item.id)}>
                  <TableCell>{item.level}</TableCell>
                  <TableCell className="font-medium flex items-center gap-2">{item.name} <ChevronRight className="h-4 w-4 text-muted-foreground" /></TableCell>
                  <TableCell className="text-muted-foreground">{item.boardName}</TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon"><Edit className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {(!data?.data || data.data.length === 0) && (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">{boardId ? 'No standards found for this board.' : 'Select a board first.'}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function SubjectsTab({ standardId, onSelectSubject }: { standardId?: number, onSelectSubject: (id: number) => void }) {
  const { data, isLoading } = useListSubjects({ standardId });
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Subjects</CardTitle>
          <CardDescription>Academic subjects. Click to see its chapters.</CardDescription>
        </div>
        <Button size="sm"><Plus className="mr-2 h-4 w-4" /> Add Subject</Button>
      </CardHeader>
      <CardContent>
        {isLoading ? <Skeleton className="h-64 w-full" /> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Standard</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.data.map((item) => (
                <TableRow key={item.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onSelectSubject(item.id)}>
                  <TableCell className="font-mono text-xs">{item.code}</TableCell>
                  <TableCell className="font-medium flex items-center gap-2">{item.name} <ChevronRight className="h-4 w-4 text-muted-foreground" /></TableCell>
                  <TableCell className="text-muted-foreground">{item.standardName}</TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon"><Edit className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {(!data?.data || data.data.length === 0) && (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">{standardId ? 'No subjects found.' : 'Select a standard first.'}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function ChaptersTab({ subjectId, onSelectChapter }: { subjectId?: number, onSelectChapter: (id: number) => void }) {
  const { data, isLoading } = useListChapters({ subjectId });
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Chapters</CardTitle>
          <CardDescription>Subject chapters. Click to see its topics.</CardDescription>
        </div>
        <Button size="sm"><Plus className="mr-2 h-4 w-4" /> Add Chapter</Button>
      </CardHeader>
      <CardContent>
        {isLoading ? <Skeleton className="h-64 w-full" /> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.data.map((item) => (
                <TableRow key={item.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onSelectChapter(item.id)}>
                  <TableCell>{item.orderIndex}</TableCell>
                  <TableCell className="font-medium flex items-center gap-2">{item.name} <ChevronRight className="h-4 w-4 text-muted-foreground" /></TableCell>
                  <TableCell className="text-muted-foreground">{item.subjectName}</TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon"><Edit className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {(!data?.data || data.data.length === 0) && (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">{subjectId ? 'No chapters found.' : 'Select a subject first.'}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function TopicsTab({ chapterId }: { chapterId?: number }) {
  const { data, isLoading } = useListTopics({ chapterId });
  const deleteTopic = useDeleteTopic();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [aiDialogOpen, setAiDialogOpen] = useState(false);

  const handleDelete = (id: number) => {
    deleteTopic.mutate({ id }, {
      onSuccess: () => {
        toast({ title: 'Topic deleted' });
        queryClient.invalidateQueries({ queryKey: getListTopicsQueryKey() });
      },
      onError: (err) => {
        toast({ variant: 'destructive', title: 'Failed to delete', description: err.message });
      }
    });
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Topics</CardTitle>
            <CardDescription>
              {chapterId ? 'Specific learning topics for the selected chapter.' : 'Select a chapter first to see its topics.'}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={!chapterId}
              onClick={() => setAiDialogOpen(true)}
              className="border-primary/50 text-primary hover:bg-primary/10"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Generate with AI
            </Button>
            <Button size="sm" disabled={!chapterId}>
              <Plus className="mr-2 h-4 w-4" /> Add Topic
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-64 w-full" /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Questions</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.data.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm max-w-sm truncate">{item.description ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{item.questionsCount}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.isActive ? 'default' : 'secondary'}>{item.isActive ? 'Active' : 'Inactive'}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon"><Edit className="h-4 w-4" /></Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete topic?</AlertDialogTitle>
                            <AlertDialogDescription>This cannot be undone. Any questions linked to this topic will also be affected.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(item.id)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
                {(!data?.data || data.data.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      {chapterId
                        ? 'No topics yet. Add one manually or use "Generate with AI" to auto-populate.'
                        : 'Select a chapter from the Chapters tab first.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {chapterId && (
        <AiGenerateTopicsDialog
          open={aiDialogOpen}
          onClose={() => setAiDialogOpen(false)}
          chapterId={chapterId}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: getListTopicsQueryKey() });
          }}
        />
      )}
    </>
  );
}

interface AiGenerateTopicsDialogProps {
  open: boolean;
  onClose: () => void;
  chapterId: number;
  onSaved: () => void;
}

function AiGenerateTopicsDialog({ open, onClose, chapterId, onSaved }: AiGenerateTopicsDialogProps) {
  const { toast } = useToast();
  const token = useAuthStore((s) => s.token);

  const { data: providers } = useListAiProviders();

  const [providerId, setProviderId] = useState<string>('');
  const [model, setModel] = useState<string>('');
  const [count, setCount] = useState<number>(10);

  const [step, setStep] = useState<'config' | 'review'>('config');
  const [generatedTopics, setGeneratedTopics] = useState<AiTopic[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [chapterName, setChapterName] = useState('');

  const selectedProvider = providers?.find(p => p.id === parseInt(providerId));

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/topics/ai-generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ chapterId, providerId: parseInt(providerId), model, count }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error ?? 'Generation failed');
      }
      return res.json() as Promise<{ topics: AiTopic[]; chapterName: string }>;
    },
    onSuccess: (data) => {
      setGeneratedTopics(data.topics);
      setChapterName(data.chapterName);
      setSelected(new Set(data.topics.map((_, i) => i)));
      setStep('review');
    },
    onError: (err: Error) => {
      toast({ variant: 'destructive', title: 'Generation failed', description: err.message });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const toSave = generatedTopics.filter((_, i) => selected.has(i));
      const res = await fetch('/api/topics/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ chapterId, topics: toSave }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error ?? 'Save failed');
      }
      return res.json() as Promise<{ saved: number }>;
    },
    onSuccess: (data) => {
      toast({ title: `${data.saved} topics saved!`, description: `Added to chapter successfully.` });
      onSaved();
      handleClose();
    },
    onError: (err: Error) => {
      toast({ variant: 'destructive', title: 'Save failed', description: err.message });
    },
  });

  const handleClose = () => {
    setStep('config');
    setGeneratedTopics([]);
    setSelected(new Set());
    onClose();
  };

  const toggleSelect = (idx: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(generatedTopics.map((_, i) => i)));
  const deselectAll = () => setSelected(new Set());

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-2xl">
        {step === 'config' ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                AI Topic Generator
              </DialogTitle>
              <DialogDescription>
                AI will analyze the chapter and suggest curriculum-aligned topics with descriptions. You can review and select which ones to save.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>AI Provider</Label>
                  <Select value={providerId} onValueChange={(v) => { setProviderId(v); setModel(''); }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select provider" />
                    </SelectTrigger>
                    <SelectContent>
                      {providers?.map(p => (
                        <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Model</Label>
                  <Select value={model} onValueChange={setModel} disabled={!providerId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select model" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedProvider?.availableModels?.map(m => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Number of topics to generate</Label>
                <Input
                  type="number"
                  min={3}
                  max={20}
                  value={count}
                  onChange={(e) => setCount(parseInt(e.target.value) || 10)}
                  className="w-32"
                />
                <p className="text-xs text-muted-foreground">AI will generate this many topic suggestions (3–20). You can deselect any before saving.</p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button
                onClick={() => generateMutation.mutate()}
                disabled={!providerId || !model || generateMutation.isPending}
              >
                {generateMutation.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating…</>
                ) : (
                  <><Sparkles className="mr-2 h-4 w-4" /> Generate Topics</>
                )}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                Review Generated Topics
              </DialogTitle>
              <DialogDescription>
                AI generated {generatedTopics.length} topics for <strong>{chapterName}</strong>.
                Select the ones you want to save — {selected.size} selected.
              </DialogDescription>
            </DialogHeader>

            <div className="flex gap-2 text-sm">
              <button onClick={selectAll} className="text-primary hover:underline">Select all</button>
              <span className="text-muted-foreground">·</span>
              <button onClick={deselectAll} className="text-muted-foreground hover:underline">Deselect all</button>
            </div>

            <ScrollArea className="h-[360px] rounded-md border p-2">
              <div className="space-y-2">
                {generatedTopics.map((topic, i) => (
                  <div
                    key={i}
                    onClick={() => toggleSelect(i)}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      selected.has(i)
                        ? 'bg-primary/5 border-primary/30'
                        : 'bg-muted/30 border-transparent opacity-50'
                    }`}
                  >
                    <Checkbox
                      checked={selected.has(i)}
                      onCheckedChange={() => toggleSelect(i)}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-0.5 shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="font-medium text-sm leading-tight">{topic.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{topic.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setStep('config')}>
                Back
              </Button>
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={selected.size === 0 || saveMutation.isPending}
              >
                {saveMutation.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</>
                ) : (
                  <>Save {selected.size} Topic{selected.size !== 1 ? 's' : ''}</>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
