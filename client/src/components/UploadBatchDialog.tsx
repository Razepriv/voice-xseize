import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, Calendar, Check, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { AiAgent, PhoneNumber } from "@shared/schema";

interface UploadBatchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UploadBatchDialog({ open, onOpenChange }: UploadBatchDialogProps) {
  const { toast } = useToast();
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [selectedPhoneNumber, setSelectedPhoneNumber] = useState<string>("");
  const [runMode, setRunMode] = useState<"now" | "schedule">("now");
  const [scheduledTime, setScheduledTime] = useState<string>("");

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

  // Upload batch mutation
  const uploadBatchMutation = useMutation({
    mutationFn: async () => {
      if (!csvFile || !selectedAgent || !selectedPhoneNumber) {
        throw new Error("Please fill all required fields");
      }

      const formData = new FormData();
      formData.append('file', csvFile);
      formData.append('agent_id', selectedAgent);
      formData.append('from_phone_number', selectedPhoneNumber);
      // Webhook URL is predefined on backend using PUBLIC_WEBHOOK_URL

      const res = await fetch('/api/batches', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to upload batch');
      }

      const data = await res.json();

      // If scheduled, schedule the batch
      if (runMode === 'schedule' && scheduledTime) {
        const scheduleRes = await apiRequest(
          'POST',
          `/api/batches/${data.batch_id}/schedule`,
          { scheduled_at: new Date(scheduledTime).toISOString() }
        );
        return scheduleRes.json();
      }

      // If run now, trigger immediate execution
      if (runMode === 'now') {
        const runRes = await apiRequest(
          'POST',
          `/api/batches/${data.batch_id}/run`
        );
        return runRes.json();
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/batches'] });
      toast({
        title: "Success",
        description: runMode === "now" 
          ? "Batch uploaded and will start immediately" 
          : "Batch scheduled successfully",
      });
      onOpenChange(false);
      // Reset form
      setCsvFile(null);
      setSelectedAgent("");
      setSelectedPhoneNumber("");
      setRunMode("now");
      setScheduledTime("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to upload batch",
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Upload Batch</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Select a CSV file to upload.
          </p>
        </DialogHeader>

        <div className="space-y-6">
          {/* CSV Upload Info */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Ensure that your CSV file includes a column labeled{" "}
              <code className="text-xs bg-secondary px-1 py-0.5 rounded">contact_number</code>{" "}
              for phone numbers.
              If your agent prompt uses variables (e.g.,{" "}
              <code className="text-xs bg-secondary px-1 py-0.5 rounded">{"{{customer_name}}"}</code>),
              add each as a separate CSV column using the exact variable name as the header (e.g.,{" "}
              <code className="text-xs bg-secondary px-1 py-0.5 rounded">customer_name</code>).
            </AlertDescription>
          </Alert>

          {/* File Upload */}
          <div>
            <Label>Batch</Label>
            <div className="mt-2 border-2 border-dashed rounded-lg p-8 text-center">
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
                  <p className="text-xs text-muted-foreground mt-2">Only .csv files are supported</p>
                </div>
              )}
            </div>
          </div>

          {/* Phone Number Selection */}
          <div>
            <Label>Calls will be made via Plivo using:</Label>
            <Select value={selectedPhoneNumber} onValueChange={setSelectedPhoneNumber}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Bolna managed phone numbers" />
              </SelectTrigger>
              <SelectContent>
                {phoneNumbers.length === 0 ? (
                  <SelectItem value="_none_" disabled>
                    No phone numbers available
                  </SelectItem>
                ) : (
                  phoneNumbers.map((phone) => (
                    <SelectItem key={phone.id} value={phone.phoneNumber}>
                      {phone.phoneNumber} {phone.friendlyName && `(${phone.friendlyName})`}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Agent Selection */}
          <div>
            <Label>Select Agent</Label>
            <Select value={selectedAgent} onValueChange={setSelectedAgent}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Select an agent" />
              </SelectTrigger>
              <SelectContent>
                {agents.length === 0 ? (
                  <SelectItem value="_none_" disabled>
                    No agents available
                  </SelectItem>
                ) : (
                  agents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.bolnaAgentId || agent.id}>
                      {agent.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Run Mode Selection */}
          <div>
            <Label>When do you want to run this batch?</Label>
            <RadioGroup value={runMode} onValueChange={(v) => setRunMode(v as "now" | "schedule")} className="mt-2">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="now" id="run-now" />
                <Label htmlFor="run-now" className="font-normal cursor-pointer">
                  Run Now
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="schedule" id="schedule" />
                <Label htmlFor="schedule" className="font-normal cursor-pointer">
                  <Calendar className="h-4 w-4 inline mr-1" />
                  Schedule
                </Label>
              </div>
            </RadioGroup>

            {runMode === "now" && (
              <Alert className="mt-2 bg-green-50 border-green-200">
                <Check className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  Batch will start immediately after creation
                </AlertDescription>
              </Alert>
            )}

            {runMode === "schedule" && (
              <div className="mt-2">
                <Input
                  type="datetime-local"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="w-full"
                />
              </div>
            )}
          </div>

          {/* Submit Button */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => uploadBatchMutation.mutate()}
              disabled={!csvFile || !selectedAgent || !selectedPhoneNumber || uploadBatchMutation.isPending}
            >
              {uploadBatchMutation.isPending ? "Uploading..." : "Confirm"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
