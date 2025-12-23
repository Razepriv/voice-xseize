import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { ArrowLeft, Upload, FileText, Loader2, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const uploadFormSchema = z.object({
  file: z.instanceof(File).refine(
    (file) => {
      const ext = file.name.split('.').pop()?.toLowerCase();
      return ext === 'csv' || ext === 'xlsx' || ext === 'xls';
    },
    { message: "Please select a CSV or Excel file" }
  ),
});

type UploadFormData = z.infer<typeof uploadFormSchema>;

export default function LeadUpload() {
  const [, params] = useRoute("/campaigns/:id/upload-leads");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [uploadResult, setUploadResult] = useState<{ count: number } | null>(null);

  const form = useForm<UploadFormData>({
    resolver: zodResolver(uploadFormSchema),
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('campaignId', params?.id || '');

      const response = await fetch('/api/leads/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Upload failed');
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/leads'] });
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns', params?.id] });
      setUploadResult({ count: data.count });
      form.reset();
      toast({
        title: "Success",
        description: `${data.count} leads uploaded successfully`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: UploadFormData) => {
    uploadMutation.mutate(data.file);
  };

  const downloadSampleCsv = () => {
    const csvContent = 'name,email,phone,company\nJohn Doe,john@example.com,+1234567890,Acme Corp\nJane Smith,jane@example.com,+0987654321,Tech Inc';
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sample_leads.csv';
    link.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 p-2 md:p-3 max-w-3xl mx-auto">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(`/campaigns/${params?.id}`)}
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="heading-upload-leads">
            Upload Leads
          </h1>
          <p className="text-muted-foreground">
            Import leads from CSV or Excel file
          </p>
        </div>
      </div>

      {uploadResult && (
        <Alert className="border-primary/20 bg-primary/5">
          <CheckCircle2 className="h-4 w-4 text-primary" />
          <AlertDescription>
            Successfully uploaded {uploadResult.count} leads to the campaign
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>File Upload</CardTitle>
          <CardDescription>
            Upload a CSV or Excel file with lead information. Required columns: name. Optional: email, phone, company.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="file"
                render={({ field: { value, onChange, ...field } }) => (
                  <FormItem>
                    <FormLabel>Select File</FormLabel>
                    <FormControl>
                      <Input
                        type="file"
                        accept=".csv,.xlsx,.xls"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            onChange(file);
                            setUploadResult(null);
                          }
                        }}
                        data-testid="input-file-upload"
                        {...field}
                      />
                    </FormControl>
                    {value && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <FileText className="h-4 w-4" />
                        <span data-testid="text-selected-file">{value.name}</span>
                        <span className="text-xs">({(value.size / 1024).toFixed(1)} KB)</span>
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                disabled={uploadMutation.isPending}
                data-testid="button-upload"
                className="w-full"
              >
                {uploadMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Leads
                  </>
                )}
              </Button>
            </form>
          </Form>

          <div className="pt-4 border-t">
            <h3 className="text-sm font-medium mb-2">CSV Format</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Your CSV file should have the following columns:
            </p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside mb-4">
              <li><strong>name</strong> (required) - Lead's full name</li>
              <li><strong>email</strong> (optional) - Email address</li>
              <li><strong>phone</strong> (optional) - Phone number</li>
              <li><strong>company</strong> (optional) - Company name</li>
            </ul>
            <Button
              variant="outline"
              onClick={downloadSampleCsv}
              data-testid="button-download-sample"
            >
              <FileText className="h-4 w-4 mr-2" />
              Download Sample CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {uploadResult && (
        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => navigate(`/campaigns/${params?.id}/upload-leads`)}
            data-testid="button-upload-more"
          >
            Upload More Leads
          </Button>
          <Button
            onClick={() => navigate(`/campaigns/${params?.id}`)}
            data-testid="button-view-campaign"
          >
            View Campaign
          </Button>
        </div>
      )}
    </div>
  );
}
