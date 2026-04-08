import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";

interface KeyValueEditorProps {
  value: Record<string, string>;
  onChange: (value: Record<string, string>) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  label?: string;
}

export function KeyValueEditor({
  value,
  onChange,
  keyPlaceholder = "Key",
  valuePlaceholder = "Value",
  label,
}: KeyValueEditorProps) {
  const entries = Object.entries(value);

  function handleKeyChange(oldKey: string, newKey: string) {
    const newValue: Record<string, string> = {};
    for (const [k, v] of Object.entries(value)) {
      if (k === oldKey) {
        newValue[newKey] = v;
      } else {
        newValue[k] = v;
      }
    }
    onChange(newValue);
  }

  function handleValueChange(key: string, newVal: string) {
    onChange({ ...value, [key]: newVal });
  }

  function handleAdd() {
    let newKey = "";
    let i = 0;
    while (newKey in value || newKey === "") {
      newKey = `key${i === 0 ? "" : i}`;
      i++;
    }
    onChange({ ...value, [newKey]: "" });
  }

  function handleRemove(key: string) {
    const newValue = { ...value };
    delete newValue[key];
    onChange(newValue);
  }

  return (
    <div className="space-y-3">
      {label && <Label>{label}</Label>}
      {entries.map(([key, val], index) => (
        <div key={index} className="flex items-center gap-2">
          <Input
            value={key}
            onChange={(e) => handleKeyChange(key, e.target.value)}
            placeholder={keyPlaceholder}
            className="flex-1"
          />
          <Input
            value={val}
            onChange={(e) => handleValueChange(key, e.target.value)}
            placeholder={valuePlaceholder}
            className="flex-1"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => handleRemove(key)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleAdd}
        className="w-full"
      >
        <Plus className="mr-2 h-4 w-4" />
        Add Entry
      </Button>
    </div>
  );
}
