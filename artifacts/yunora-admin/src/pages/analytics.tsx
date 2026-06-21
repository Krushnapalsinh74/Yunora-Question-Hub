import React from 'react';
import { 
  useGetDashboardStats,
  useGetQuestionsByDifficulty,
  useGetModelUsage,
  useGetMonthlyReport,
  useGetQuestionsBySubject
} from '@workspace/api-client-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function AnalyticsPage() {
  const { data: difficultyData, isLoading: difficultyLoading } = useGetQuestionsByDifficulty();
  const { data: monthlyData, isLoading: monthlyLoading } = useGetMonthlyReport();
  const { data: subjectData, isLoading: subjectLoading } = useGetQuestionsBySubject();
  const { data: modelData, isLoading: modelLoading } = useGetModelUsage();

  const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground">Deep dive into generation metrics and quality scores.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Questions by Subject</CardTitle>
            <CardDescription>Volume of generated content per subject</CardDescription>
          </CardHeader>
          <CardContent>
            {subjectLoading ? (
              <Skeleton className="h-[350px] w-full" />
            ) : (
              <div className="h-[350px] w-full">
                {subjectData && subjectData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={subjectData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="hsl(var(--border))" />
                      <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis dataKey="subjectName" type="category" stroke="hsl(var(--foreground))" fontSize={12} tickLine={false} axisLine={false} width={100} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: 'var(--radius)' }}
                        cursor={{fill: 'hsl(var(--muted))'}}
                      />
                      <Bar dataKey="count" name="Questions" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} barSize={24} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">No data available</div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Monthly Generation Output</CardTitle>
            <CardDescription>Historical trend of generated questions</CardDescription>
          </CardHeader>
          <CardContent>
            {monthlyLoading ? (
              <Skeleton className="h-[350px] w-full" />
            ) : (
              <div className="h-[350px] w-full">
                {monthlyData && monthlyData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: 'var(--radius)' }}
                        cursor={{fill: 'hsl(var(--muted))'}}
                      />
                      <Bar dataKey="count" name="Questions" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">No data available</div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Model Quality Performance</CardTitle>
            <CardDescription>Average quality scores and usage volume</CardDescription>
          </CardHeader>
          <CardContent>
            {modelLoading ? (
              <Skeleton className="h-[350px] w-full" />
            ) : (
              <div className="h-[350px] w-full overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Model</TableHead>
                      <TableHead>Provider</TableHead>
                      <TableHead className="text-right">Questions</TableHead>
                      <TableHead className="text-right">Avg Quality (/10)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {modelData?.map((m, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{m.model}</TableCell>
                        <TableCell>{m.provider}</TableCell>
                        <TableCell className="text-right">{m.count.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-medium text-primary">
                          {m.avgQualityScore.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!modelData || modelData.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">No data available</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Difficulty Distribution</CardTitle>
            <CardDescription>Breakdown by question complexity</CardDescription>
          </CardHeader>
          <CardContent>
            {difficultyLoading ? (
              <Skeleton className="h-[350px] w-full" />
            ) : (
              <div className="h-[350px] w-full flex items-center justify-center">
                {difficultyData && difficultyData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={difficultyData}
                        cx="50%"
                        cy="50%"
                        innerRadius={80}
                        outerRadius={120}
                        paddingAngle={5}
                        dataKey="count"
                        nameKey="difficulty"
                        label
                      >
                        {difficultyData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: 'var(--radius)' }}
                      />
                      <Legend verticalAlign="bottom" height={36} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">No data available</div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
