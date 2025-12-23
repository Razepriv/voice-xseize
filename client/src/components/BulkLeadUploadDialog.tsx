import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Upload, Sparkles, Phone, Bot, CheckCircle2, Info, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import type { AiAgent, PhoneNumber } from "@shared/schema";

interface BulkLeadUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BulkLeadUploadDialog({ open, onOpenChange }: BulkLeadUploadDialogProps) {
  const { toast } = useToast();
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [enableAIAssignment, setEnableAIAssignment] = useState(true);
  const [enableAutoCalling, setEnableAutoCalling] = useState(false);
  const [selectedPhoneNumber, setSelectedPhoneNumber] = useState<string>("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<string>("");

  // Fetch agents
  const { data: agents = [] } = useQuery<AiAgent[]>({
    queryKey: ['/api/ai-agents'],
    enabled: open,
  });

  // Fetch phone numbers
  const { data: phoneNumbers = [] } = useQuery<PhoneNumber[]>({
    queryKey: ['/api/phone-numbers'],
    enabled: open,
  });

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setCsvFile(null);
      setEnableAIAssignment(true);
      setEnableAutoCalling(false);
      setSelectedPhoneNumber("");
      setUploadProgress(0);
      setUploadStatus("");
    }
  }, [open]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        setCsvFile(file);
      } else {
        toast({
          title: "Invalid file",
          description: "Only CSV files are supported",
          variant: "destructive",
        });
      }
    }
  };

  // Upload and process mutation
  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!csvFile) {
        throw new Error("Please select a CSV file");
      }

      if (enableAutoCalling && !selectedPhoneNumber) {
        throw new Error("Please select a phone number for auto-calling");
      }

      setUploadProgress(10);
      setUploadStatus("Uploading leads...");

      const formData = new FormData();
      formData.append('file', csvFile);
      formData.append('enableAIAssignment', String(enableAIAssignment));
      formData.append('enableAutoCalling', String(enableAutoCalling));
      if (selectedPhoneNumber) {
        formData.append('fromPhoneNumber', selectedPhoneNumber);
      }

      const response = await fetch('/api/leads/bulk-upload-and-call', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Upload failed');
      }

      setUploadProgress(50);
      setUploadStatus("Processing leads...");

      const result = await response.json();

      setUploadProgress(100);
      setUploadStatus("Complete!");

      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/leads'] });
      toast({
        title: "Success",
        description: data.message || `${data.leadsCreated} leads uploaded successfully`,
      });
      
      setTimeout(() => {
        onOpenChange(false);
      }, 1500);
    },
    onError: (error: Error) => {
      setUploadProgress(0);
      setUploadStatus("");
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const downloadSampleCsv = () => {
    const csvContent = `name,email,phone,company,notes
John Doe,john@example.com,+919876543210,Acme Corp,Interested in enterprise plan
Jane Smith,jane@example.com,+919876543211,Tech Inc,Follow up on demo request
Bob Wilson,bob@example.com,+919876543212,StartupXYZ,Needs pricing information`;
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sample_leads.csv';
    link.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Bulk Upload Leads
          </DialogTitle>
          <DialogDescription>
            Upload leads from CSV, let AI assign them to agents, and optionally start calling automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* CSV Format Info */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              CSV must include columns: <code className="text-xs bg-secondary px-1 py-0.5 rounded">name</code>,{" "}
              <code className="text-xs bg-secondary px-1 py-0.5 rounded">phone</code>. Optional:{" "}
              <code className="text-xs bg-secondary px-1 py-0.5 rounded">email</code>,{" "}
              <code className="text-xs bg-secondary px-1 py-0.5 rounded">company</code>,{" "}
              <code className="text-xs bg-secondary px-1 py-0.5 rounded">notes</code>.
              <Button variant="ghost" size="sm" className="h-auto p-0 ml-2 text-primary underline" onClick={downloadSampleCsv}>
                Download sample
              </Button>
            </AlertDescription>
          </Alert>

          {/* File Upload */}
          <div>
            <Label>Select CSV File</Label>
            <div className="mt-2 border-2 border-dashed rounded-lg p-6 text-center">
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              {csvFile ? (
                <div className="space-y-1">
                  <p className="text-sm font-medium">{csvFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(csvFile.size / 1024).toFixed(2)} KB
                  </p>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setCsvFile(null)}
                    className="mt-2"
                  >
                    Remove
                  </Button>
                </div>
              ) : (
                <div>
                  <p className="text-sm mb-2">Drag and drop your CSV here, or click to browse</p>
                  <Input
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    className="max-w-xs mx-auto"
                  />
                </div>
              )}
            </div>
          </div>

          {/* AI Assignment Toggle */}
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/20 dark:to-indigo-950/20 rounded-lg border">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div>
                <Label className="text-base font-medium">AI Auto-Assignment</Label>
                <p className="text-sm text-muted-foreground">
                  AI analyzes lead details and assigns to the best matching agent
                </p>
              </div>
            </div>
            <Switch
              checked={enableAIAssignment}
              onCheckedChange={setEnableAIAssignment}
            />
          </div>

          {/* Auto-Calling Toggle */}
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 rounded-lg border">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gradient-to-r from-green-600 to-emerald-600 flex items-center justify-center">
                <Phone className="h-5 w-5 text-white" />
              </div>
              <div>
                <Label className="text-base font-medium">Auto-Call After Assignment</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically initiate calls to assigned leads
                </p>
              </div>
            </div>
            <Switch
              checked={enableAutoCalling}
              onCheckedChange={setEnableAutoCalling}
              disabled={!enableAIAssignment}
            />
          </div>

          {/* Phone Number Selection - only if auto-calling enabled */}
          {enableAutoCalling && (
            <div>
              <Label>Outbound Phone Number</Label>
              <Select value={selectedPhoneNumber} onValueChange={setSelectedPhoneNumber}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select phone number" />
                </SelectTrigger>
                <SelectContent>
                  {phoneNumbers.length === 0 ? (
                    <SelectItem value="_none_" disabled>
                      No phone numbers available
                    </SelectItem>
                  ) : (
                    phoneNumbers.map((phone) => (
                      <SelectItem key={phone.id} value={phone.phoneNumber}>
                        <span className="font-mono">{phone.phoneNumber}</span>
                        {phone.friendlyName && <span className="ml-2 text-muted-foreground">({phone.friendlyName})</span>}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Progress */}
          {uploadMutation.isPending && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{uploadStatus}</span>
                <span className="font-medium">{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} />
            </div>
          )}

          {/* Success Message */}
          {uploadProgress === 100 && (
            <Alert className="border-green-200 bg-green-50 dark:bg-green-950/20">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800 dark:text-green-200">
                Leads uploaded successfully! {enableAIAssignment && "AI is assigning leads to agents."} {enableAutoCalling && "Calls will start automatically."}
              </AlertDescription>
            </Alert>
          )}

          {/* Submit Button */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={uploadMutation.isPending}>
              Cancel
            </Button>
            <Button 
              onClick={() => uploadMutation.mutate()}
              disabled={!csvFile || uploadMutation.isPending || (enableAutoCalling && !selectedPhoneNumber)}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
            >
              {uploadMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload & Process
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
