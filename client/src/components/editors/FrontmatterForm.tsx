import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export interface FieldConfig {
  key: string;
  label: string;
  type: "text" | "number" | "boolean" | "select" | "textarea";
  options?: string[];
  placeholder?: string;
  required?: boolean;
  min?: number;
  max?: number;
  step?: number;
  description?: string;
}

interface FrontmatterFormProps {
  fields: FieldConfig[];
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  readOnly?: boolean;
}

export function FrontmatterForm({
  fields,
  values,
  onChange,
  readOnly = false,
}: FrontmatterFormProps) {
  return (
    <div className="space-y-4">
      {fields.map((field) => (
        <div key={field.key} className="space-y-2">
          <Label htmlFor={field.key}>
            {field.label}
            {field.required && <span className="text-destructive ml-1">*</span>}
          </Label>
          {field.description && (
            <p className="text-xs text-muted-foreground">{field.description}</p>
          )}
          {renderField(field, values[field.key], onChange, readOnly)}
        </div>
      ))}
    </div>
  );
}

function renderField(
  field: FieldConfig,
  value: unknown,
  onChange: (key: string, value: unknown) => void,
  readOnly: boolean,
) {
  switch (field.type) {
    case "text":
      return (
        <Input
          id={field.key}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(field.key, e.target.value)}
          placeholder={field.placeholder}
          disabled={readOnly}
          required={field.required}
        />
      );

    case "number":
      return (
        <Input
          id={field.key}
          type="number"
          value={(value as number) ?? ""}
          onChange={(e) => onChange(field.key, Number(e.target.value))}
          placeholder={field.placeholder}
          disabled={readOnly}
          required={field.required}
          min={field.min}
          max={field.max}
          step={field.step}
        />
      );

    case "boolean":
      return (
        <Switch
          checked={!!value}
          onCheckedChange={(checked: boolean) => onChange(field.key, checked)}
          disabled={readOnly}
        />
      );

    case "select":
      return (
        <Select
          value={(value as string) ?? ""}
          onValueChange={(val: string | null) => onChange(field.key, val ?? "")}
          disabled={readOnly}
        >
          <SelectTrigger>
            <SelectValue placeholder={field.placeholder ?? "Select..."} />
          </SelectTrigger>
          <SelectContent>
            {field.options?.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );

    case "textarea":
      return (
        <Textarea
          id={field.key}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(field.key, e.target.value)}
          placeholder={field.placeholder}
          disabled={readOnly}
          required={field.required}
        />
      );

    default:
      return null;
  }
}
