import { useState } from "react";
import { CheckCircle2, Clock, FileSignature, Send, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/use-toast";

export type ApprovalStage = "draft" | "pending" | "approved";

const stages: { id: ApprovalStage; label: string; icon: typeof FileSignature }[] = [
  { id: "draft", label: "Draft", icon: FileSignature },
  { id: "pending", label: "Pending Review", icon: Clock },
  { id: "approved", label: "Approved", icon: CheckCircle2 },
];

interface Props {
  reportName: string;
  initial?: ApprovalStage;
}

export const ApprovalWorkflow = ({ reportName, initial = "draft" }: Props) => {
  const [stage, setStage] = useState<ApprovalStage>(initial);
  const [signedBy, setSignedBy] = useState<string | null>(null);

  const advance = () => {
    if (stage === "draft") {
      setStage("pending");
      toast({ title: "Submitted for review", description: `${reportName} sent to reviewer.` });
    } else if (stage === "pending") {
      setStage("approved");
      setSignedBy("John Kamau · CFO");
      toast({
        title: "Report approved & signed",
        description: `${reportName} digitally signed by John Kamau (${new Date().toISOString().slice(0, 10)}).`,
      });
    }
  };

  const reset = () => {
    setStage("draft");
    setSignedBy(null);
  };

  const idx = stages.findIndex((s) => s.id === stage);

  return (
    <Card className="border border-border/60 p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">Approval Workflow</h3>
          <p className="text-xs text-muted-foreground">Draft → Pending → Approved</p>
        </div>
        <Badge
          variant="outline"
          className={cn(
            "gap-1 text-[10px] font-semibold uppercase tracking-wide",
            stage === "approved" && "border-success/30 bg-success/10 text-success",
            stage === "pending" && "border-warning/30 bg-warning/10 text-warning",
            stage === "draft" && "border-border bg-muted text-muted-foreground",
          )}
        >
          {stage === "approved" && <CheckCircle2 className="h-3 w-3" />}
          {stage === "pending" && <Clock className="h-3 w-3" />}
          {stage === "draft" && <FileSignature className="h-3 w-3" />}
          {stages[idx].label}
        </Badge>
      </div>

      {/* Stepper */}
      <ol className="mt-4 flex items-center gap-2">
        {stages.map((s, i) => {
          const reached = i <= idx;
          const Icon = s.icon;
          return (
            <li key={s.id} className="flex flex-1 items-center gap-2">
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                  reached
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "truncate text-xs font-semibold",
                    reached ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {s.label}
                </p>
              </div>
              {i < stages.length - 1 && (
                <div
                  className={cn(
                    "h-0.5 flex-1 rounded-full",
                    i < idx ? "bg-primary" : "bg-border",
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>

      {/* Signature block */}
      {stage === "approved" && signedBy && (
        <div className="mt-4 flex items-center gap-3 rounded-lg border border-success/30 bg-success/5 px-4 py-3">
          <ShieldCheck className="h-5 w-5 text-success" />
          <div>
            <p className="text-sm font-semibold text-foreground">Digitally Signed</p>
            <p className="text-[11px] text-muted-foreground">
              {signedBy} · {new Date().toLocaleString("en-KE")}
            </p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        {stage !== "draft" && (
          <Button variant="outline" size="sm" onClick={reset}>
            Reset to draft
          </Button>
        )}
        {stage !== "approved" && (
          <Button
            size="sm"
            onClick={advance}
            className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {stage === "draft" ? (
              <>
                <Send className="h-4 w-4" />
                Submit for Review
              </>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4" />
                Approve & Sign
              </>
            )}
          </Button>
        )}
      </div>
    </Card>
  );
};
