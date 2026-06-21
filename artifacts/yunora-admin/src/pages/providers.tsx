import React, { useState } from 'react';
import { 
  useListAiProviders,
  useCreateAiProvider,
  useDeleteAiProvider,
  useTestAiProvider,
  getListAiProvidersQueryKey,
  AiProviderInputProviderType
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Cpu, Plus, Trash2, ShieldCheck, ShieldAlert, KeyRound, Loader2 } from 'lucide-react';

const providerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  providerType: z.enum(['openai', 'anthropic', 'azure_openai', 'gemini', 'groq', 'github_models']),
  accessToken: z.string().min(1, "Access token is required"),
  defaultModel: z.string().min(1, "Default model is required"),
  availableModels: z.string().transform(str => str.split(',').map(s => s.trim()).filter(Boolean)),
  isActive: z.boolean().default(true)
});

type ProviderFormValues = z.infer<typeof providerSchema>;

export default function ProvidersPage() {
  const { data: providers, isLoading } = useListAiProviders();
  const deleteProvider = useDeleteAiProvider();
  const testProvider = useTestAiProvider();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [testingId, setTestingId] = useState<number | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const handleDelete = (id: number) => {
    if(confirm("Remove this provider?")) {
      deleteProvider.mutate({ id }, {
        onSuccess: () => {
          toast({ title: 'Provider removed' });
          queryClient.invalidateQueries({ queryKey: getListAiProvidersQueryKey() });
        }
      });
    }
  };

  const handleTest = (id: number) => {
    setTestingId(id);
    testProvider.mutate({ id }, {
      onSuccess: (res) => {
        if (res.success) {
          toast({ 
            title: "Connection Successful", 
            description: `Latency: ${res.latencyMs}ms`,
            className: "bg-green-500/10 border-green-500/20"
          });
        } else {
          toast({ 
            variant: "destructive",
            title: "Connection Failed", 
            description: res.message
          });
        }
        setTestingId(null);
      },
      onError: () => {
        toast({ variant: "destructive", title: "Test Error", description: "Network or server error." });
        setTestingId(null);
      }
    });
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Providers</h1>
          <p className="text-muted-foreground">Configure LLM endpoints and manage API keys.</p>
        </div>
        
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <SheetTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Add Provider</Button>
          </SheetTrigger>
          <SheetContent className="sm:max-w-md overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Add AI Provider</SheetTitle>
            </SheetHeader>
            <div className="mt-6">
              <ProviderForm onSuccess={() => setIsSheetOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {providers?.map((provider) => (
          <Card key={provider.id} className={`flex flex-col ${!provider.isActive && 'opacity-60'}`}>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <div className="bg-primary/10 p-2 rounded-md">
                    <Cpu className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{provider.name}</CardTitle>
                    <CardDescription>{provider.providerType}</CardDescription>
                  </div>
                </div>
                <Badge variant={provider.isActive ? "default" : "secondary"}>
                  {provider.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Default Model</span>
                  <span className="font-mono">{provider.defaultModel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Available Models</span>
                  <span className="font-mono">{provider.availableModels?.length || 0}</span>
                </div>
                <div className="flex justify-between items-center pt-2">
                  <span className="text-muted-foreground flex items-center gap-1"><KeyRound className="h-3 w-3" /> API Key</span>
                  <span className="text-muted-foreground">••••••••••••</span>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between border-t bg-muted/20 p-4">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handleTest(provider.id)}
                disabled={testingId === provider.id}
              >
                {testingId === provider.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
                Test Connection
              </Button>
              <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => handleDelete(provider.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardFooter>
          </Card>
        ))}
        {(!providers || providers.length === 0) && !isLoading && (
          <Card className="col-span-full p-12 flex flex-col items-center justify-center text-center border-dashed">
            <Cpu className="h-8 w-8 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No providers configured</h3>
            <p className="text-muted-foreground mb-4 max-w-sm">Add your first AI provider to start generating questions.</p>
            <Button onClick={() => setIsSheetOpen(true)}><Plus className="mr-2 h-4 w-4" /> Add Provider</Button>
          </Card>
        )}
      </div>
    </div>
  );
}

function ProviderForm({ onSuccess }: { onSuccess: () => void }) {
  const createProvider = useCreateAiProvider();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<ProviderFormValues>({
    resolver: zodResolver(providerSchema),
    defaultValues: {
      name: '',
      providerType: 'openai',
      accessToken: '',
      defaultModel: '',
      availableModels: [] as any, // handled by transform
      isActive: true
    }
  });

  const onSubmit = (data: ProviderFormValues) => {
    // Type assertion to match generated schema which expects string[] for availableModels but form returns any after transform
    createProvider.mutate({ data: data as any }, {
      onSuccess: () => {
        toast({ title: "Provider created" });
        queryClient.invalidateQueries({ queryKey: getListAiProvidersQueryKey() });
        onSuccess();
      },
      onError: (err) => {
        toast({ variant: "destructive", title: "Error", description: err.message });
      }
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Display Name</FormLabel>
              <FormControl><Input placeholder="e.g. OpenAI Primary" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="providerType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Type</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="anthropic">Anthropic</SelectItem>
                  <SelectItem value="azure_openai">Azure OpenAI</SelectItem>
                  <SelectItem value="gemini">Google Gemini</SelectItem>
                  <SelectItem value="groq">Groq</SelectItem>
                  <SelectItem value="github_models">GitHub Models</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="accessToken"
          render={({ field }) => (
            <FormItem>
              <FormLabel>API Key / Token</FormLabel>
              <FormControl><Input type="password" placeholder="sk-..." {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="defaultModel"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Default Model</FormLabel>
              <FormControl><Input placeholder="e.g. gpt-4o" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="availableModels"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Available Models (comma separated)</FormLabel>
              <FormControl><Input placeholder="gpt-4o, gpt-4o-mini" {...field} value={field.value as any} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="isActive"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm mt-4">
              <div className="space-y-0.5">
                <FormLabel>Active Status</FormLabel>
                <div className="text-sm text-muted-foreground">Enable this provider for use.</div>
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full mt-6" disabled={createProvider.isPending}>
          {createProvider.isPending ? "Saving..." : "Save Provider"}
        </Button>
      </form>
    </Form>
  );
}
