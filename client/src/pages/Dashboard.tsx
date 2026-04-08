import { useNavigate } from "react-router-dom";
import { PageLayout } from "@/components/layout/PageLayout";
import { useResource } from "@/hooks/useResource";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Sparkles, Terminal, Bot, Server, KeyRound } from "lucide-react";

interface ResourceCount {
  label: string;
  path: string;
  icon: React.ElementType;
}

const resources: ResourceCount[] = [
  { label: "Skills", path: "/skills", icon: Sparkles },
  { label: "Commands", path: "/commands", icon: Terminal },
  { label: "Agents", path: "/agents", icon: Bot },
  { label: "MCP Servers", path: "/mcp-servers", icon: Server },
  { label: "Providers", path: "/providers", icon: KeyRound },
];

function ResourceCard({
  label,
  path,
  icon: Icon,
}: ResourceCount) {
  const navigate = useNavigate();
  const { items, loading } = useResource<unknown>(path.replace("/", "/"));

  return (
    <Card
      className="cursor-pointer transition-colors hover:ring-primary/50"
      onClick={() => navigate(path)}
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="h-5 w-5" />
          {label}
        </CardTitle>
        <CardDescription>Click to manage</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <span className="text-3xl font-bold">{items.length}</span>
        )}
      </CardContent>
    </Card>
  );
}

export function Dashboard() {
  return (
    <PageLayout title="Dashboard" description="OpenCode configuration overview">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {resources.map((resource) => (
          <ResourceCard key={resource.path} {...resource} />
        ))}
      </div>
    </PageLayout>
  );
}
