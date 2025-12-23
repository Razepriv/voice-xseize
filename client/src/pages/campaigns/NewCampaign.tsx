import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import Papa from "papaparse";

export default function NewCampaign() {
  const { toast } = useToast();
  const [campaignName, setCampaignName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [leads, setLeads] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    setFile(f || null);
    if (f) {
      Papa.parse(f, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          setLeads(results.data as any[]);
        },
        error: () => {
          toast({ title: "Error", description: "Failed to parse file", variant: "destructive" });
        },
      });
    }
  };

  const handleCreateCampaign = async () => {
    if (!campaignName || leads.length === 0) {
      toast({ title: "Error", description: "Campaign name and leads required", variant: "destructive" });
      return;
    }
    setIsUploading(true);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: campaignName, contacts: leads }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create campaign");
      toast({ title: "Success", description: "Campaign created and leads imported" });
      setCampaignName("");
      setFile(null);
      setLeads([]);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Create Campaign</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Campaign Name</Label>
            <Input value={campaignName} onChange={e => setCampaignName(e.target.value)} placeholder="Enter campaign name" />
          </div>
          <div>
            <Label>Upload Leads (CSV/Excel)</Label>
            <Input type="file" accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" onChange={handleFileChange} />
          </div>
          {leads.length > 0 && (
            <div className="border rounded p-2 max-h-40 overflow-auto">
              <div className="font-bold mb-1">Preview ({leads.length} leads)</div>
              <table className="text-xs w-full">
                <thead>
                  <tr>
                    {Object.keys(leads[0]).map((k) => <th key={k} className="px-1 text-left">{k}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {leads.slice(0, 10).map((row, i) => (
                    <tr key={i}>
                      {Object.values(row).map((v, j) => <td key={j} className="px-1">{v as string}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
              {leads.length > 10 && <div className="text-muted-foreground text-xs">...and {leads.length - 10} more</div>}
            </div>
          )}
          <Button onClick={handleCreateCampaign} disabled={isUploading || !campaignName || leads.length === 0}>
            {isUploading ? "Creating..." : "Create Campaign & Import Leads"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
