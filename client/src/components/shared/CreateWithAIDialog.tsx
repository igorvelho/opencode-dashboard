// client/src/components/shared/CreateWithAIDialog.tsx

import { useState } from "react";
import { toast } from "sonner";
import { Sparkles, Copy, RotateCcw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { EntityType } from "@/lib/entityDescriptions";
import { ENTITY_DESCRIPTIONS } from "@/lib/entityDescriptions";
import { buildPrompt } from "@/lib/promptBuilder";

interface CreateWithAIDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: EntityType;
  existingNames: string[];
  configPath: string;
}

type DialogState = "input" | "generated";

export function CreateWithAIDialog({
  open,
  onOpenChange,
  entityType,
  existingNames,
  configPath,
}: CreateWithAIDialogProps) {
  const [state, setState] = useState<DialogState>("input");
  const [description, setDescription] = useState("");
  const [prompt, setPrompt] = useState("");
  const [copying, setCopying] = useState(false);

  const entityLabel =
    entityType === "skill"
      ? "skill"
      : entityType === "command"
        ? "command"
        : "agent";

  function handleOpenChange(open: boolean) {
    if (!open) {
      // Reset state when dialog closes
      setState("input");
      setDescription("");
      setPrompt("");
    }
    onOpenChange(open);
  }

  function handleGenerate() {
    const resolvedConfigPath = configPath || "~/.config/opencode";
    const generated = buildPrompt(entityType, {
      userDescription: description.trim(),
      existingNames,
      configPath: resolvedConfigPath,
    });
    setPrompt(generated);
    setState("generated");
  }

  async function handleCopy() {
    if (copying) return;
    setCopying(true);
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(prompt);
      } else {
        // Fallback for environments without Clipboard API
        const textarea = document.createElement("textarea");
        textarea.value = prompt;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const success = document.execCommand("copy");
        document.body.removeChild(textarea);
        if (!success) throw new Error("execCommand copy failed");
      }
      toast.success("Prompt copied! Paste it into your OpenCode session.");
    } catch {
      toast.error("Failed to copy to clipboard");
    } finally {
      setCopying(false);
    }
  }

  function handleGenerateAnother() {
    setState("input");
    setDescription("");
    setPrompt("");
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Create {entityLabel} with AI
          </DialogTitle>
          <DialogDescription>{ENTITY_DESCRIPTIONS[entityType]}</DialogDescription>
        </DialogHeader>

        {state === "input" ? (
          <>
            <Textarea
              placeholder={`Describe the ${entityLabel} you want to create...`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              className="resize-none"
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleGenerate}
                disabled={description.trim().length === 0}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Generate Prompt
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="rounded-lg border border-border bg-muted/50 p-4 text-center space-y-3">
              <p className="text-sm text-muted-foreground">
                Your prompt is ready. Copy it and paste it into your OpenCode session.
              </p>
              <Button onClick={handleCopy} className="w-full" size="lg" disabled={copying}>
                <Copy className="mr-2 h-4 w-4" />
                Copy to Clipboard
              </Button>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleGenerateAnother}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Generate Another
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
