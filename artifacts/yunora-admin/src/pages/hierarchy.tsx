import React, { useState } from 'react';
import { 
  useListBoards, 
  useListStandards, 
  useListSubjects, 
  useListChapters, 
  useListTopics,
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
  getListTopicsQueryKey
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, Edit, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
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
          <CardDescription>Top-level educational bodies.</CardDescription>
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
                <TableRow key={board.id} className="cursor-pointer" onClick={() => onSelectBoard(board.id)}>
                  <TableCell className="font-mono text-xs">{board.code}</TableCell>
                  <TableCell className="font-medium">{board.name}</TableCell>
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
                          <AlertDialogDescription>This will permanently delete the board and all nested standards, subjects, chapters, and topics.</AlertDialogDescription>
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

// Similar stubs for StandardsTab, SubjectsTab, ChaptersTab, TopicsTab...
function StandardsTab({ boardId, onSelectStandard }: { boardId?: number, onSelectStandard: (id: number) => void }) {
  const { data, isLoading } = useListStandards({ boardId });
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Standards</CardTitle>
          <CardDescription>Grade levels or equivalent.</CardDescription>
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
                <TableRow key={item.id} className="cursor-pointer" onClick={() => onSelectStandard(item.id)}>
                  <TableCell>{item.level}</TableCell>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell className="text-muted-foreground">{item.boardName}</TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon"><Edit className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {(!data?.data || data.data.length === 0) && (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">No standards found.</TableCell>
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
          <CardDescription>Academic subjects.</CardDescription>
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
                <TableRow key={item.id} className="cursor-pointer" onClick={() => onSelectSubject(item.id)}>
                  <TableCell className="font-mono text-xs">{item.code}</TableCell>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell className="text-muted-foreground">{item.standardName}</TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon"><Edit className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {(!data?.data || data.data.length === 0) && (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">No subjects found.</TableCell>
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
          <CardDescription>Subject chapters.</CardDescription>
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
                <TableRow key={item.id} className="cursor-pointer" onClick={() => onSelectChapter(item.id)}>
                  <TableCell>{item.orderIndex}</TableCell>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell className="text-muted-foreground">{item.subjectName}</TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon"><Edit className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {(!data?.data || data.data.length === 0) && (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">No chapters found.</TableCell>
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
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Topics</CardTitle>
          <CardDescription>Specific learning topics.</CardDescription>
        </div>
        <Button size="sm"><Plus className="mr-2 h-4 w-4" /> Add Topic</Button>
      </CardHeader>
      <CardContent>
        {isLoading ? <Skeleton className="h-64 w-full" /> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Chapter</TableHead>
                <TableHead>Questions</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.data.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell className="text-muted-foreground">{item.chapterName}</TableCell>
                  <TableCell>{item.questionsCount}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon"><Edit className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {(!data?.data || data.data.length === 0) && (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">No topics found.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
