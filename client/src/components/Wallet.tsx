import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Wallet as WalletIcon, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useWebSocketEvent } from "@/lib/useWebSocket";
import { queryClient } from "@/lib/queryClient";

type OrganizationWithCredits = {
  credits?: number;
  [key: string]: any;
};

export function Wallet() {
  const { data: organization } = useQuery<OrganizationWithCredits>({
    queryKey: ["/api/organization"],
  });

  // Real-time updates for credits
  useWebSocketEvent('organization:updated', useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['/api/organization'] });
  }, []));

  useWebSocketEvent('credits:updated', useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['/api/organization'] });
  }, []));

  const credits = organization?.credits ?? 0;
  const formattedCredits = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(credits);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border bg-background hover:bg-accent transition-colors">
          <WalletIcon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium" data-testid="wallet-balance">
            {formattedCredits}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-primary hover:text-primary-foreground"
            onClick={() => window.location.href = '/billing?action=add-credits'}
            data-testid="button-add-credits"
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p className="text-xs">Account Balance</p>
        <p className="text-xs text-muted-foreground">Click + to add credits</p>
      </TooltipContent>
    </Tooltip>
  );
}
