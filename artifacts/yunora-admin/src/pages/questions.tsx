import React, { useState } from 'react';
import { 
  useListQuestions,
  useDeleteQuestion,
  getListQuestionsQueryKey,
  listQuestions,
  customFetch,
} from '@workspace/api-client-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, Trash2, FileDown, X, CheckSquare, Square } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { MathText } from '@/lib/math-text';
import { useAuthStore } from '@/hooks/use-auth';

type Difficulty = 'easy' | 'medium' | 'hard' | 'advanced';

const DIFFICULTY_OPTIONS: { value: Difficulty; label: string; cls: string; color: string }[] = [
  { value: 'easy',     label: 'Easy',     cls: 'bg-green-500/10 text-green-700 border-green-500/30 hover:bg-green-500/20',   color: 'text-green-700' },
  { value: 'medium',   label: 'Medium',   cls: 'bg-amber-500/10 text-amber-700 border-amber-500/30 hover:bg-amber-500/20',   color: 'text-amber-700' },
  { value: 'hard',     label: 'Hard',     cls: 'bg-red-500/10 text-red-700 border-red-500/30 hover:bg-red-500/20',           color: 'text-red-700'   },
  { value: 'advanced', label: 'Advanced', cls: 'bg-purple-500/10 text-purple-700 border-purple-500/30 hover:bg-purple-500/20', color: 'text-purple-700' },
];

interface DiffCount { difficulty: string; count: number; }

function stripMath(text: string): string {
  if (!text) return '';
  return text
    // Unwrap display and inline math delimiters
    .replace(/\$\$([\s\S]*?)\$\$/g, '$1')
    .replace(/\$(.*?)\$/g, '$1')
    // \text{...} → plain text
    .replace(/\\text\{([^}]*)\}/g, '$1')
    // \frac{a}{b} → a/b  (no extra parentheses for readability)
    .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '$1/$2')
    // Greek letters → unicode
    .replace(/\\alpha/g, 'α').replace(/\\beta/g, 'β').replace(/\\gamma/g, 'γ')
    .replace(/\\delta/g, 'δ').replace(/\\epsilon/g, 'ε').replace(/\\zeta/g, 'ζ')
    .replace(/\\eta/g, 'η').replace(/\\theta/g, 'θ').replace(/\\iota/g, 'ι')
    .replace(/\\kappa/g, 'κ').replace(/\\lambda/g, 'λ').replace(/\\mu/g, 'μ')
    .replace(/\\nu/g, 'ν').replace(/\\xi/g, 'ξ').replace(/\\pi/g, 'π')
    .replace(/\\rho/g, 'ρ').replace(/\\sigma/g, 'σ').replace(/\\tau/g, 'τ')
    .replace(/\\upsilon/g, 'υ').replace(/\\phi/g, 'φ').replace(/\\chi/g, 'χ')
    .replace(/\\psi/g, 'ψ').replace(/\\omega/g, 'ω')
    .replace(/\\Gamma/g, 'Γ').replace(/\\Delta/g, 'Δ').replace(/\\Theta/g, 'Θ')
    .replace(/\\Lambda/g, 'Λ').replace(/\\Xi/g, 'Ξ').replace(/\\Pi/g, 'Π')
    .replace(/\\Sigma/g, 'Σ').replace(/\\Phi/g, 'Φ').replace(/\\Psi/g, 'Ψ')
    .replace(/\\Omega/g, 'Ω')
    // Trig / math functions → plain names
    .replace(/\\sin/g, 'sin').replace(/\\cos/g, 'cos').replace(/\\tan/g, 'tan')
    .replace(/\\cot/g, 'cot').replace(/\\sec/g, 'sec').replace(/\\csc/g, 'csc')
    .replace(/\\log/g, 'log').replace(/\\ln/g, 'ln').replace(/\\exp/g, 'exp')
    .replace(/\\lim/g, 'lim').replace(/\\sum/g, 'Σ').replace(/\\prod/g, 'Π')
    .replace(/\\int/g, '∫').replace(/\\infty/g, '∞').replace(/\\pm/g, '±')
    .replace(/\\times/g, '×').replace(/\\div/g, '÷').replace(/\\cdot/g, '·')
    .replace(/\\neq/g, '≠').replace(/\\leq/g, '≤').replace(/\\geq/g, '≥')
    .replace(/\\approx/g, '≈').replace(/\\sqrt\{([^}]*)\}/g, '√($1)')
    // Superscript: x^{2} → x²  or  x^2 → x²  (common cases)
    .replace(/\^\{([^}]*)\}/g, '^$1')
    // Subscript: x_{n} → x_n
    .replace(/_\{([^}]*)\}/g, '_$1')
    // Strip remaining backslash commands and braces
    .replace(/\\[a-zA-Z]+/g, '')
    .replace(/[{}]/g, '')
    .trim();
}

const PAGE_SIZE = 50;

export default function QuestionsPage() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty | ''>('');
  const [questionType, setQuestionType] = useState('');
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const token = useAuthStore((s) => s.token);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  const queryParams = {
    search: debouncedSearch || undefined,
    difficulty: (difficulty as Difficulty) || undefined,
    questionType: questionType || undefined,
    page,
    limit: PAGE_SIZE,
  };

  const { data, isLoading } = useListQuestions(queryParams);
  const deleteQuestion = useDeleteQuestion();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [deletingAll, setDeletingAll] = useState(false);

  // ── Difficulty summary counts (global, no filter) ──
  const { data: diffCounts } = useQuery<DiffCount[]>({
    queryKey: ['analytics', 'questions-by-difficulty'],
    queryFn: () => customFetch<DiffCount[]>('/api/analytics/questions-by-difficulty'),
    staleTime: 30_000,
  });

  const countFor = (d: Difficulty) =>
    diffCounts?.find(c => c.difficulty === d)?.count ?? 0;

  // ── Selection helpers ──
  const visibleIds = data?.data?.map(q => q.id) ?? [];
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.has(id));

  const toggleSelect = (id: number) =>
    setSelectedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds(prev => { const s = new Set(prev); visibleIds.forEach(id => s.delete(id)); return s; });
    } else {
      setSelectedIds(prev => { const s = new Set(prev); visibleIds.forEach(id => s.add(id)); return s; });
    }
  };

  const clearSelection = () => setSelectedIds(new Set());

  // ── Handlers ──
  const handleDelete = (id: number) => {
    if (confirm('Delete this question?')) {
      deleteQuestion.mutate({ id }, {
        onSuccess: () => {
          toast({ title: 'Question deleted' });
          queryClient.invalidateQueries({ queryKey: getListQuestionsQueryKey() });
          queryClient.invalidateQueries({ queryKey: ['analytics'] });
        },
      });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} selected question${selectedIds.size !== 1 ? 's' : ''}? This cannot be undone.`)) return;
    setBulkDeleting(true);
    let success = 0;
    let fail = 0;
    for (const id of selectedIds) {
      try {
        await fetch(`/api/questions/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        success++;
      } catch {
        fail++;
      }
    }
    clearSelection();
    toast({ title: `Deleted ${success} question${success !== 1 ? 's' : ''}${fail > 0 ? ` (${fail} failed)` : ''}` });
    queryClient.invalidateQueries({ queryKey: getListQuestionsQueryKey() });
    queryClient.invalidateQueries({ queryKey: ['analytics'] });
    setBulkDeleting(false);
  };

  const handleDeleteAll = async () => {
    const total = data?.total ?? 0;
    if (!confirm(`Delete all ${total} question${total !== 1 ? 's' : ''}? This cannot be undone.`)) return;
    setDeletingAll(true);
    try {
      const res = await fetch('/api/questions', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed');
      toast({ title: 'All questions deleted' });
      clearSelection();
      queryClient.invalidateQueries({ queryKey: getListQuestionsQueryKey() });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
    } catch {
      toast({ title: 'Error deleting questions', variant: 'destructive' });
    } finally {
      setDeletingAll(false);
    }
  };

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const allData = await listQuestions({ ...queryParams, page: 1, limit: 9999 });
      const questions = allData?.data ?? [];

      if (questions.length === 0) {
        toast({ title: 'No questions to export', variant: 'destructive' });
        return;
      }

      const { default: jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 18;
      const contentW = pageW - margin * 2;
      let y = margin;

      const checkPage = (needed: number) => {
        if (y + needed > pageH - margin) { doc.addPage(); y = margin; }
      };
      const writeWrapped = (text: string, size: number, style: 'normal' | 'bold' = 'normal', color: [number,number,number] = [30,30,30], indent = 0) => {
        doc.setFontSize(size); doc.setFont('helvetica', style); doc.setTextColor(...color);
        const lines = doc.splitTextToSize(stripMath(text), contentW - indent);
        for (const line of lines) { checkPage(size * 0.5); doc.text(line, margin + indent, y); y += size * 0.45; }
        y += 1;
      };
      const drawDivider = () => {
        doc.setDrawColor(200,200,200); doc.setLineWidth(0.3);
        doc.line(margin, y, pageW - margin, y); y += 4;
      };

      doc.setFillColor(37, 99, 235);
      doc.rect(0, 0, pageW, 28, 'F');
      doc.setFontSize(18); doc.setFont('helvetica', 'bold'); doc.setTextColor(255,255,255);
      doc.text('Yunora Question Bank', margin, 13);
      doc.setFontSize(9); doc.setFont('helvetica', 'normal');
      doc.text(`Exported ${format(new Date(), 'dd MMM yyyy, HH:mm')}  •  ${questions.length} question${questions.length !== 1 ? 's' : ''}${debouncedSearch ? `  •  Filter: "${debouncedSearch}"` : ''}`, margin, 22);
      y = 36;

      const diffLabel: Record<string, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard', advanced: 'Advanced' };
      const diffColor: Record<string, [number,number,number]> = { easy: [22,163,74], medium: [202,138,4], hard: [234,88,12], advanced: [220,38,38] };

      questions.forEach((q, idx) => {
        checkPage(30);
        doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(30,30,30);
        doc.text(`Q${idx + 1}`, margin, y);
        const diffStr = diffLabel[q.difficulty] ?? q.difficulty.toUpperCase();
        const color = diffColor[q.difficulty] ?? [100,100,100];
        doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...color);
        doc.text(diffStr, margin + 9, y);
        doc.setTextColor(100,100,100); doc.setFont('helvetica', 'normal');
        doc.text(`• ${q.questionType ?? ''}`, margin + 9 + doc.getTextWidth(diffStr) + 2, y);
        const meta = `${q.subjectName ?? ''} › ${q.chapterName ?? ''}`;
        doc.setFontSize(7.5); doc.setTextColor(140,140,140);
        doc.text(meta, pageW - margin - doc.getTextWidth(meta), y);
        y += 6;
        writeWrapped(q.question, 10, 'normal', [20,20,20]);
        y += 1;
        if (q.options) {
          const opts = q.options.split('\n').filter(Boolean);
          if (opts.length > 0) {
            doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(80,80,80);
            doc.text('Options:', margin, y); y += 4.5;
            opts.forEach(opt => writeWrapped(opt, 9, 'normal', [50,50,50], 4));
          }
        }
        checkPage(12);
        doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(22,101,52);
        doc.text('Answer:', margin, y); y += 4.5;
        writeWrapped(q.correctAnswer ?? '', 9, 'normal', [22,101,52], 4);
        if (q.explanation) {
          checkPage(12);
          doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(80,80,80);
          doc.text('Explanation:', margin, y); y += 4.5;
          writeWrapped(q.explanation, 8.5, 'normal', [90,90,90], 4);
        }
        checkPage(8);
        doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(160,160,160);
        const footerParts = [`Score: ${q.qualityScore ?? '—'}/10`, q.modelUsed ? `Model: ${q.modelUsed}` : null, q.generatedAt ? format(parseISO(q.generatedAt), 'dd MMM yyyy') : null].filter(Boolean).join('  •  ');
        doc.text(footerParts, margin, y); y += 5;
        if (idx < questions.length - 1) { checkPage(6); drawDivider(); }
      });

      const totalPages = (doc.internal as any).getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p); doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(160,160,160);
        doc.text(`Page ${p} of ${totalPages}`, pageW - margin, pageH - 8, { align: 'right' });
        doc.text('Yunora AI', margin, pageH - 8);
      }

      const filename = `yunora-questions-${format(new Date(), 'yyyyMMdd-HHmm')}${debouncedSearch ? `-${debouncedSearch.replace(/\s+/g, '_')}` : ''}.pdf`;
      doc.save(filename);
      toast({ title: `Exported ${questions.length} questions`, description: filename });
    } catch (err) {
      console.error(err);
      toast({ title: 'Export failed', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  const getDifficultyColor = (diff: string) => {
    switch (diff) {
      case 'easy':     return 'bg-green-500/10 text-green-700 border-green-500/20';
      case 'medium':   return 'bg-amber-500/10 text-amber-700 border-amber-500/20';
      case 'hard':     return 'bg-red-500/10 text-red-700 border-red-500/20';
      case 'advanced': return 'bg-purple-500/10 text-purple-700 border-purple-500/20';
      default:         return '';
    }
  };

  const activeFilters = [difficulty, questionType].filter(Boolean).length;
  const clearFilters = () => { setDifficulty(''); setQuestionType(''); setSearch(''); setPage(1); };

  return (
    <div className="space-y-6 pb-10">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Question Library</h1>
          <p className="text-muted-foreground">Browse, edit, and curate generated questions.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {selectedIds.size > 0 ? (
            <>
              <span className="text-sm text-muted-foreground">{selectedIds.size} selected</span>
              <Button variant="outline" size="sm" onClick={clearSelection}>
                <X className="h-4 w-4 mr-1" /> Deselect
              </Button>
              <Button variant="destructive" size="sm" onClick={handleBulkDelete} disabled={bulkDeleting}>
                <Trash2 className="h-4 w-4 mr-2" />
                {bulkDeleting ? 'Deleting…' : `Delete ${selectedIds.size}`}
              </Button>
            </>
          ) : data?.total != null && data.total > 0 && (
            <>
              <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={exporting} className="shrink-0">
                <FileDown className="h-4 w-4 mr-2" />
                {exporting ? 'Exporting…' : 'Export PDF'}
              </Button>
              <Button variant="destructive" size="sm" onClick={handleDeleteAll} disabled={deletingAll} className="shrink-0">
                <Trash2 className="h-4 w-4 mr-2" />
                {deletingAll ? 'Deleting…' : `Delete All (${data.total})`}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ── Difficulty summary mini-cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {DIFFICULTY_OPTIONS.map((opt) => {
          const cnt = countFor(opt.value);
          const isActive = difficulty === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => { setDifficulty(d => d === opt.value ? '' : opt.value); setPage(1); clearSelection(); }}
              className={`rounded-xl border px-4 py-3 text-left transition-all hover:shadow-md ${
                isActive ? opt.cls + ' ring-2 ring-offset-1 ring-current shadow-sm' : 'bg-card border-border hover:border-current ' + opt.cls
              }`}
            >
              <p className={`text-2xl font-bold tabular-nums ${opt.color}`}>{cnt.toLocaleString()}</p>
              <p className="text-xs font-medium text-muted-foreground mt-0.5">{opt.label}</p>
            </button>
          );
        })}
      </div>

      {/* ── Filter bar ── */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search questions..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {DIFFICULTY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setDifficulty(d => d === opt.value ? '' : opt.value); setPage(1); clearSelection(); }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-all ${
                difficulty === opt.value
                  ? opt.cls + ' ring-2 ring-offset-1 ring-current'
                  : 'border-border text-muted-foreground hover:border-current ' + opt.cls
              }`}
            >
              {opt.label}
            </button>
          ))}

          <Select value={questionType || '__all__'} onValueChange={(v) => { setQuestionType(v === '__all__' ? '' : v); setPage(1); clearSelection(); }}>
            <SelectTrigger className="h-8 text-xs w-[160px]">
              <SelectValue placeholder="Question type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All types</SelectItem>
              <SelectItem value="mcq">MCQ</SelectItem>
              <SelectItem value="true-false">True / False</SelectItem>
              <SelectItem value="fill-blank">Fill in the Blank</SelectItem>
              <SelectItem value="one-word">One Word</SelectItem>
              <SelectItem value="very-short">Very Short Answer</SelectItem>
              <SelectItem value="short-answer">Short Answer</SelectItem>
              <SelectItem value="long-answer">Long Answer</SelectItem>
              <SelectItem value="assertion-reason">Assertion Reason</SelectItem>
              <SelectItem value="match-following">Match the Following</SelectItem>
              <SelectItem value="hots">HOTS</SelectItem>
              <SelectItem value="case-study">Case Study</SelectItem>
              <SelectItem value="numerical">Numerical</SelectItem>
            </SelectContent>
          </Select>

          {(activeFilters > 0 || search) && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 px-2 text-muted-foreground">
              <X className="h-3.5 w-3.5 mr-1" /> Clear
            </Button>
          )}
        </div>
      </div>

      {/* ── Active filter summary + select-all row ── */}
      {data && (
        <div className="flex items-center justify-between -mt-2">
          <p className="text-sm text-muted-foreground">
            {data.total} question{data.total !== 1 ? 's' : ''}
            {difficulty ? ` · ${DIFFICULTY_OPTIONS.find(d => d.value === difficulty)?.label}` : ''}
            {questionType ? ` · ${questionType}` : ''}
            {debouncedSearch ? ` · matching "${debouncedSearch}"` : ''}
          </p>
          {data.data && data.data.length > 0 && (
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {allVisibleSelected
                ? <CheckSquare className="h-4 w-4 text-primary" />
                : <Square className="h-4 w-4" />}
              {allVisibleSelected ? 'Deselect page' : 'Select page'}
            </button>
          )}
        </div>
      )}

      {/* ── Question list ── */}
      {isLoading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      ) : data?.data && data.data.length > 0 ? (
        <div className="space-y-3">
          <Accordion type="single" collapsible className="w-full space-y-3">
            {data.data.map((q) => {
              const isSelected = selectedIds.has(q.id);
              return (
                <AccordionItem
                  key={q.id}
                  value={`q-${q.id}`}
                  className={`border rounded-lg bg-card px-4 shadow-sm transition-colors ${isSelected ? 'border-primary/50 bg-primary/5' : ''}`}
                >
                  <AccordionTrigger className="hover:no-underline py-4">
                    <div className="flex items-start gap-3 w-full pr-4">
                      {/* Checkbox — stop propagation so accordion doesn't toggle */}
                      <div
                        onClick={(e) => { e.stopPropagation(); toggleSelect(q.id); }}
                        className="mt-0.5 shrink-0"
                      >
                        <Checkbox checked={isSelected} className="pointer-events-none" />
                      </div>
                      <div className="flex flex-col items-start text-left gap-2 flex-1 min-w-0">
                        <div className="flex items-center gap-2 w-full">
                          <Badge variant="outline" className={getDifficultyColor(q.difficulty)}>
                            {q.difficulty.toUpperCase()}
                          </Badge>
                          <Badge variant="outline">{q.questionType}</Badge>
                          <span className="text-xs text-muted-foreground ml-auto whitespace-nowrap">
                            {q.subjectName} • {q.chapterName}
                          </span>
                        </div>
                        <span className="font-medium text-base line-clamp-2">
                          <MathText>{q.question}</MathText>
                        </span>
                      </div>
                    </div>
                  </AccordionTrigger>

                  <AccordionContent className="pt-2 pb-4 border-t ml-9">
                    <div className="space-y-4">
                      {q.options && (
                        <div>
                          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Options</h4>
                          <div className="bg-muted/50 rounded-md divide-y divide-border overflow-hidden">
                            {q.options.split('\n').filter(Boolean).map((opt, idx) => (
                              <div key={idx} className="px-3 py-2 text-sm"><MathText>{opt}</MathText></div>
                            ))}
                          </div>
                        </div>
                      )}
                      <div>
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Correct Answer</h4>
                        <div className="bg-primary/5 text-primary border border-primary/10 p-3 rounded-md text-sm font-medium">
                          <MathText>{q.correctAnswer}</MathText>
                        </div>
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Explanation</h4>
                        <div className="text-sm text-muted-foreground leading-relaxed bg-muted/30 p-3 rounded-md">
                          <MathText block>{q.explanation}</MathText>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center justify-between pt-4 gap-4">
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span title="Quality Score">Score: {q.qualityScore}/10</span>
                          <span>Model: {q.modelUsed}</span>
                          <span>{q.generatedAt ? format(parseISO(q.generatedAt), 'MMM d, yyyy') : ''}</span>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => handleDelete(q.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" /> Delete
                        </Button>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </div>
      ) : (
        <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <Search className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold">No questions found</h3>
          <p className="text-muted-foreground max-w-sm mt-2 mb-6">
            No questions yet. Generate some from the Generate tab.
          </p>
          <Button variant="outline" onClick={() => setSearch('')}>Clear search</Button>
        </Card>
      )}

      {/* ── Pagination ── */}
      {data && data.total > PAGE_SIZE && (
        <div className="flex items-center justify-between pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, data.total)} of {data.total}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Previous</Button>
            <span className="text-sm text-muted-foreground px-2">Page {page} of {Math.ceil(data.total / PAGE_SIZE)}</span>
            <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page * PAGE_SIZE >= data.total}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
