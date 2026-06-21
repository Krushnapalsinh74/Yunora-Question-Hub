import React from 'react';
import { 
  useListGenerationJobs,
  useGetGenerationJob
} from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, parseISO } from 'date-fns';
import { Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function JobsPage() {
  const { data, isLoading } = useListGenerationJobs({ limit: 50 });

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'completed': return <Badge className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20 hover:bg-green-500/20"><CheckCircle2 className="mr-1 h-3 w-3" /> Completed</Badge>;
      case 'processing': return <Badge className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20 hover:bg-blue-500/20"><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Processing</Badge>;
      case 'failed': return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" /> Failed</Badge>;
      default: return <Badge variant="outline"><Clock className="mr-1 h-3 w-3" /> Pending</Badge>;
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Generation Jobs</h1>
        <p className="text-muted-foreground">Monitor AI processing queues and historical tasks.</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job ID</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Started</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.data.map((job) => (
                  <JobRow key={job.jobId} job={job} badge={getStatusBadge(job.status)} />
                ))}
                {(!data?.data || data.data.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">No jobs found.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function JobRow({ job, badge }: { job: any, badge: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <TableRow className="cursor-pointer hover:bg-muted/50">
          <TableCell className="font-mono text-xs">{job.jobId.substring(0, 8)}...</TableCell>
          <TableCell>
            <div className="flex flex-col">
              <span className="font-medium truncate max-w-[200px]">{job.topicName || 'Unknown Topic'}</span>
              <span className="text-xs text-muted-foreground">{job.subjectName}</span>
            </div>
          </TableCell>
          <TableCell className="text-sm">{job.model}</TableCell>
          <TableCell>
            <div className="text-sm">
              <span className={job.totalGenerated === job.totalRequested ? "text-green-600 font-medium" : ""}>
                {job.totalGenerated || 0}
              </span>
              <span className="text-muted-foreground"> / {job.totalRequested}</span>
            </div>
          </TableCell>
          <TableCell>{badge}</TableCell>
          <TableCell className="text-sm text-muted-foreground">
            {format(parseISO(job.createdAt), 'MMM d, h:mm a')}
          </TableCell>
        </TableRow>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Job Details</DialogTitle>
          <div className="flex items-center gap-2 pt-2">
            {badge}
            <span className="text-sm text-muted-foreground">ID: {job.jobId}</span>
          </div>
        </DialogHeader>
        <div className="flex-1 overflow-hidden">
          <JobDetailsContent jobId={job.jobId} open={open} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function JobDetailsContent({ jobId, open }: { jobId: string, open: boolean }) {
  // Only fetch when dialog is open
  const { data, isLoading } = useGetGenerationJob(jobId, { query: { enabled: open } });

  if (isLoading) return <div className="p-8 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (!data) return <div className="p-8 text-center text-muted-foreground">No data available</div>;

  return (
    <ScrollArea className="h-full pr-4">
      <div className="space-y-6 pb-4">
        {data.errorMessage && (
          <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm border border-destructive/20">
            <strong>Error:</strong> {data.errorMessage}
          </div>
        )}

        {data.agentLogs && (
          <div>
            <h4 className="text-sm font-semibold mb-2">Agent Logs</h4>
            <div className="bg-zinc-950 text-zinc-300 p-4 rounded-md text-xs font-mono whitespace-pre-wrap">
              {data.agentLogs}
            </div>
          </div>
        )}

        <div>
          <h4 className="text-sm font-semibold mb-2">Generated Questions ({data.questions?.length || 0})</h4>
          <div className="space-y-3">
            {data.questions?.map((q, i) => (
              <Card key={q.id || i} className="p-4 bg-muted/30">
                <p className="font-medium text-sm mb-2">{i+1}. {q.question}</p>
                <div className="text-xs text-muted-foreground">
                  <strong>Answer:</strong> {q.correctAnswer}
                </div>
              </Card>
            ))}
            {(!data.questions || data.questions.length === 0) && (
              <p className="text-sm text-muted-foreground italic">No questions generated yet.</p>
            )}
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}
