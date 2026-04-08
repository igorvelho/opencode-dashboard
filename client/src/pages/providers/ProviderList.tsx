import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageLayout } from "@/components/layout/PageLayout";
import { useResource } from "@/hooks/useResource";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Plus, ChevronDown, ChevronRight, Settings } from "lucide-react";

interface ModelConfig {
  options?: Record<string, unknown>;
  variants?: Record<string, Record<string, unknown>>;
}

interface ProviderConfig {
  options?: Record<string, unknown>;
  models?: Record<string, ModelConfig>;
  [key: string]: unknown;
}

interface Provider {
  name: string;
  config: ProviderConfig;
  lastModified: string;
}

export function ProviderList() {
  const navigate = useNavigate();
  const { items, loading, error } = useResource<Provider>("/providers");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleExpand(name: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }

  return (
    <PageLayout
      title="Providers & Models"
      description="Manage provider configurations and models"
      actions={
        <Button onClick={() => navigate("/providers/new")}>
          <Plus className="mr-2 h-4 w-4" />
          New Provider
        </Button>
      }
    >
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          {error}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No providers configured. Add your first provider to get started.
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((provider) => {
            const models = provider.config.models ?? {};
            const modelNames = Object.keys(models);
            const isExpanded = expanded.has(provider.name);

            return (
              <Card key={provider.name}>
                <CardHeader
                  className="cursor-pointer"
                  onClick={() => toggleExpand(provider.name)}
                >
                  <CardTitle className="flex items-center gap-2">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    {provider.name}
                    <Badge variant="secondary" className="ml-2">
                      {modelNames.length} model{modelNames.length !== 1 ? "s" : ""}
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    Last modified: {new Date(provider.lastModified).toLocaleDateString()}
                  </CardDescription>
                </CardHeader>
                {isExpanded && (
                  <CardContent>
                    <div className="space-y-3">
                      {modelNames.length > 0 ? (
                        <div className="space-y-2">
                          {modelNames.map((modelName) => {
                            const model = models[modelName];
                            const variantCount = model?.variants
                              ? Object.keys(model.variants).length
                              : 0;

                            return (
                              <div
                                key={modelName}
                                className="flex items-center justify-between rounded-md border px-3 py-2"
                              >
                                <div>
                                  <span className="font-mono text-sm">{modelName}</span>
                                  {variantCount > 0 && (
                                    <Badge variant="outline" className="ml-2 text-xs">
                                      {variantCount} variant{variantCount !== 1 ? "s" : ""}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          No models configured
                        </p>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(
                            `/providers/${encodeURIComponent(provider.name)}`,
                          );
                        }}
                      >
                        <Settings className="mr-2 h-3 w-3" />
                        Edit Provider
                      </Button>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </PageLayout>
  );
}
