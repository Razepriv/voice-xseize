import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Settings as SettingsIcon,
  User,
  Building2,
  Phone,
  Key,
  Bell,
  Shield,
  CreditCard,
  Webhook,
  Database,
  Palette,
  Upload,
} from "lucide-react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { queryClient } from "@/lib/queryClient";
import { useWebSocketEvent } from "@/lib/useWebSocket";

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("profile");
  const [companyName, setCompanyName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("");
  const [firstName, setFirstName] = useState(user?.firstName || "");
  const [lastName, setLastName] = useState(user?.lastName || "");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [isConfiguringWebhook, setIsConfiguringWebhook] = useState(false);
  const [isConfiguringEmail, setIsConfiguringEmail] = useState(false);
  const [isEnablingCallAlerts, setIsEnablingCallAlerts] = useState(false);
  const [isEnablingDailySummary, setIsEnablingDailySummary] = useState(false);

  const { data: phoneNumbers = [] } = useQuery<any[]>({
    queryKey: ["/api/phone-numbers"],
  });

  const { data: aiAgents = [] } = useQuery<any[]>({
    queryKey: ["/api/ai-agents"],
  });

  const { data: organization } = useQuery<any>({
    queryKey: ["/api/organization"],
  });

  useEffect(() => {
    if (organization) {
      setCompanyName(organization.companyName || "");
      setLogoUrl(organization.logoUrl || "");
      setPrimaryColor(organization.primaryColor || "");
    }
  }, [organization]);


  // Real-time updates for all settings-related entities
  useWebSocketEvent('organization:updated', () => {
    queryClient.invalidateQueries({ queryKey: ['/api/organization'] });
  }, user?.organizationId);

  useWebSocketEvent('phone:created', () => {
    queryClient.invalidateQueries({ queryKey: ['/api/phone-numbers'] });
  }, user?.organizationId);

  useWebSocketEvent('phone:updated', () => {
    queryClient.invalidateQueries({ queryKey: ['/api/phone-numbers'] });
  }, user?.organizationId);

  useWebSocketEvent('agent:created', () => {
    queryClient.invalidateQueries({ queryKey: ['/api/ai-agents'] });
  }, user?.organizationId);

  useWebSocketEvent('agent:updated', () => {
    queryClient.invalidateQueries({ queryKey: ['/api/ai-agents'] });
  }, user?.organizationId);

  useWebSocketEvent('campaign:created', () => {
    queryClient.invalidateQueries({ queryKey: ['/api/campaigns'] });
  }, user?.organizationId);

  useWebSocketEvent('campaign:updated', () => {
    queryClient.invalidateQueries({ queryKey: ['/api/campaigns'] });
  }, user?.organizationId);

  useWebSocketEvent('contact:created', () => {
    queryClient.invalidateQueries({ queryKey: ['/api/leads'] });
  }, user?.organizationId);

  useWebSocketEvent('contact:updated', () => {
    queryClient.invalidateQueries({ queryKey: ['/api/leads'] });
  }, user?.organizationId);

  const updateWhitelabelMutation = useMutation({
    mutationFn: async (data: { companyName: string; logoUrl: string; primaryColor: string }) => {
      const response = await fetch("/api/organization/whitelabel", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to update whitelabel");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organization"] });
      toast({
        title: "Success",
        description: "Whitelabel settings updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update whitelabel settings",
        variant: "destructive",
      });
    },
  });

  // Save profile handler
  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    try {
      const response = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName }),
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to update profile");
      toast({ title: "Success", description: "Profile updated successfully" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setIsSavingProfile(false);
    }
  };

  // 2FA handler (real logic)
  const handleEnable2FA = async () => {
    setIs2FAEnabled(true);
    try {
      const response = await fetch("/api/user/enable-2fa", {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to enable 2FA");
      toast({ title: "2FA", description: "Two-factor authentication enabled successfully" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  // Webhook config handler (real logic)
  const handleConfigureWebhook = async () => {
    setIsConfiguringWebhook(true);
    try {
      const response = await fetch("/api/organization/webhook", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhookUrl }),
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to configure webhook");
      toast({ title: "Webhook", description: "Webhook configured successfully" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setIsConfiguringWebhook(false);
    }
  };

  // Email notification config handler (real logic)
  const handleConfigureEmail = async () => {
    setIsConfiguringEmail(true);
    try {
      const response = await fetch("/api/user/notifications/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: true }),
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to enable email notifications");
      toast({ title: "Email Notifications", description: "Email notifications enabled successfully" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setIsConfiguringEmail(false);
    }
  };

  // Call alerts enable handler (real logic)
  const handleEnableCallAlerts = async () => {
    setIsEnablingCallAlerts(true);
    try {
      const response = await fetch("/api/user/notifications/call-alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: true }),
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to enable call alerts");
      toast({ title: "Call Alerts", description: "Call alerts enabled successfully" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setIsEnablingCallAlerts(false);
    }
  };

  // Daily summary enable handler (real logic)
  const handleEnableDailySummary = async () => {
    setIsEnablingDailySummary(true);
    try {
      const response = await fetch("/api/user/notifications/daily-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: true }),
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to enable daily summary");
      toast({ title: "Daily Summary", description: "Daily summary enabled successfully" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setIsEnablingDailySummary(false);
    }
  };

  // Apply brand color to document body if set
  useEffect(() => {
    if (primaryColor) {
      document.body.style.setProperty('--brand-primary', primaryColor);
    }
  }, [primaryColor]);

  return (
    <div className="flex flex-col gap-4 p-2">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="heading-settings">
            Settings
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your account and platform preferences
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5">
          <TabsTrigger value="profile">
            <User className="h-4 w-4 mr-2" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="whitelabel">
            <Palette className="h-4 w-4 mr-2" />
            Branding
          </TabsTrigger>
          <TabsTrigger value="organization">
            <Building2 className="h-4 w-4 mr-2" />
            Organization
          </TabsTrigger>
          <TabsTrigger value="integration">
            <Webhook className="h-4 w-4 mr-2" />
            Integrations
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="h-4 w-4 mr-2" />
            Notifications
          </TabsTrigger>
        </TabsList>

        {/* Profile Settings */}
        <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>
                Your account details and preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    placeholder="Enter first name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    placeholder="Enter last name"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  defaultValue={user?.email || ""}
                  placeholder="Enter email"
                  disabled
                />
                <p className="text-sm text-muted-foreground">
                  Email is managed through your authentication provider
                </p>
              </div>

              <div className="space-y-2">
                <Label>Role</Label>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{user?.role}</Badge>
                  <span className="text-sm text-muted-foreground">
                    Contact admin to change your role
                  </span>
                </div>
              </div>

              <Separator className="my-4" />

              <div className="flex justify-end">
                <Button onClick={handleSaveProfile} disabled={isSavingProfile}>
                  <User className="h-4 w-4 mr-2" />
                  {isSavingProfile ? "Saving..." : "Save Profile"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Security</CardTitle>
              <CardDescription>
                Password and authentication settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="font-medium">Authentication</p>
                  <p className="text-sm text-muted-foreground">
                    Managed by your authentication provider
                  </p>
                </div>
                <Shield className="h-8 w-8 text-muted-foreground" />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="font-medium">Two-Factor Authentication</p>
                  <p className="text-sm text-muted-foreground">
                    Add an extra layer of security
                  </p>
                </div>
                <Button variant="outline" onClick={handleEnable2FA} disabled={is2FAEnabled}>
                  {is2FAEnabled ? "2FA Enabled" : "Enable 2FA"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Whitelabel Settings */}
        <TabsContent value="whitelabel" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Company Branding</CardTitle>
              <CardDescription>
                Customize your platform with your company name and logo
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="companyName">Company Name</Label>
                <Input
                  id="companyName"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Enter your company name"
                />
                <p className="text-sm text-muted-foreground">
                  This will appear in the header of your platform
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="logoUrl">Logo URL</Label>
                <Input
                  id="logoUrl"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://example.com/logo.png"
                />
                <p className="text-sm text-muted-foreground">
                  Enter the URL of your company logo (recommended: 200x50px, transparent background)
                </p>
              </div>

              {logoUrl && (
                <div className="space-y-2">
                  <Label>Logo Preview</Label>
                  <div className="border rounded-md p-4 bg-muted/50">
                    <img
                      src={logoUrl}
                      alt="Logo preview"
                      className="h-12 object-contain"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="primaryColor">Primary Brand Color (Optional)</Label>
                <div className="flex gap-2">
                  <Input
                    id="primaryColor"
                    type="color"
                    value={primaryColor || "#000000"}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-20 h-10"
                  />
                  <Input
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    placeholder="#000000"
                    className="flex-1"
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Choose your brand's primary color
                </p>
              </div>

              <Separator className="my-4" />

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setCompanyName(organization?.companyName || "");
                    setLogoUrl(organization?.logoUrl || "");
                    setPrimaryColor(organization?.primaryColor || "");
                  }}
                >
                  Reset
                </Button>
                <Button
                  onClick={() => updateWhitelabelMutation.mutate({ companyName, logoUrl, primaryColor })}
                  disabled={updateWhitelabelMutation.isPending}
                >
                  <Palette className="h-4 w-4 mr-2" />
                  {updateWhitelabelMutation.isPending ? "Saving..." : "Save Branding"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Branding Tips</CardTitle>
              <CardDescription>
                Best practices for your company branding
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="h-2 w-2 rounded-full bg-primary mt-2" />
                <div>
                  <p className="font-medium">Logo Format</p>
                  <p className="text-sm text-muted-foreground">
                    Use PNG or SVG format with transparent background for best results
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-2 w-2 rounded-full bg-primary mt-2" />
                <div>
                  <p className="font-medium">Recommended Size</p>
                  <p className="text-sm text-muted-foreground">
                    Optimal logo dimensions are 200x50 pixels for header display
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-2 w-2 rounded-full bg-primary mt-2" />
                <div>
                  <p className="font-medium">Hosting</p>
                  <p className="text-sm text-muted-foreground">
                    Host your logo on a reliable CDN or image hosting service for fast loading
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Organization Settings */}
        <TabsContent value="organization" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Organization Details</CardTitle>
              <CardDescription>
                Manage your organization settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Organization ID</Label>
                <Input
                  value={user?.organizationId || ""}
                  disabled
                  className="font-mono text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label>Team Members</Label>
                <div className="text-2xl font-bold">{1}</div>
                <p className="text-sm text-muted-foreground">
                  Active users in your organization
                </p>
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Total AI Agents</Label>
                  <div className="text-2xl font-bold">{aiAgents.length}</div>
                </div>
                <div className="space-y-2">
                  <Label>Phone Numbers</Label>
                  <div className="text-2xl font-bold">{phoneNumbers.length}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Integration Settings */}
        <TabsContent value="integration" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Agent Provider Integration</CardTitle>
              <CardDescription>
                Voice AI platform configuration
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Database className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Agent Provider API</p>
                    <p className="text-sm text-muted-foreground">Connected</p>
                  </div>
                </div>
                <Badge>Active</Badge>
              </div>

              <div className="space-y-2">
                <Label>API Status</Label>
                <p className="text-sm text-muted-foreground">
                  Your Agent Provider API integration is active and configured
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Number Provider Integration</CardTitle>
              <CardDescription>
                Telephony provider configuration
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Phone className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Telephony Provider</p>
                    <p className="text-sm text-muted-foreground">
                      {phoneNumbers.length} number(s) configured
                    </p>
                  </div>
                </div>
                <Badge>Active</Badge>
              </div>

              <div className="space-y-2">
                <Label>Phone Numbers</Label>
                <div className="space-y-2">
                  {phoneNumbers.map((phone: any) => (
                    <div
                      key={phone.id}
                      className="flex items-center justify-between p-3 border rounded-md"
                    >
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span className="font-mono text-sm">{phone.phoneNumber}</span>
                      </div>
                      <Badge variant="outline">{phone.provider}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Webhooks</CardTitle>
              <CardDescription>
                Configure webhook endpoints for call events
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Webhook URL</Label>
                <Input
                  placeholder="https://your-domain.com/webhook"
                  value={webhookUrl}
                  onChange={e => setWebhookUrl(e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  Receive real-time notifications for call events
                </p>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="font-medium">Webhook Events</p>
                  <p className="text-sm text-muted-foreground">
                    Call started, ended, status changes
                  </p>
                </div>
                <Button variant="outline" onClick={handleConfigureWebhook} disabled={isConfiguringWebhook}>
                  {isConfiguringWebhook ? "Configuring..." : "Configure"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Settings */}
        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>
                Choose how you want to be notified
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="font-medium">Email Notifications</p>
                  <p className="text-sm text-muted-foreground">
                    Receive updates via email
                  </p>
                </div>
                <Button variant="outline" onClick={handleConfigureEmail} disabled={isConfiguringEmail}>
                  {isConfiguringEmail ? "Configuring..." : "Configure"}
                </Button>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="font-medium">Call Alerts</p>
                  <p className="text-sm text-muted-foreground">
                    Get notified when calls start or end
                  </p>
                </div>
                <Button variant="outline" onClick={handleEnableCallAlerts} disabled={isEnablingCallAlerts}>
                  {isEnablingCallAlerts ? "Enabling..." : "Enable"}
                </Button>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="font-medium">Daily Summary</p>
                  <p className="text-sm text-muted-foreground">
                    Receive daily activity reports
                  </p>
                </div>
                <Button variant="outline" onClick={handleEnableDailySummary} disabled={isEnablingDailySummary}>
                  {isEnablingDailySummary ? "Enabling..." : "Enable"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
