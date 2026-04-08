import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { WorkspaceContext, useWorkspaceProvider } from "./hooks/useWorkspace";
import { SidebarProvider, SidebarInset } from "./components/ui/sidebar";
import { AppSidebar } from "./components/layout/Sidebar";

// Page imports
import { Dashboard } from "./pages/Dashboard";
import { SkillList } from "./pages/skills/SkillList";
import { SkillEdit } from "./pages/skills/SkillEdit";
import { CommandList } from "./pages/commands/CommandList";
import { CommandEdit } from "./pages/commands/CommandEdit";
import { AgentList } from "./pages/agents/AgentList";
import { AgentEdit } from "./pages/agents/AgentEdit";
import { McpServerList } from "./pages/mcp-servers/McpServerList";
import { McpServerEdit } from "./pages/mcp-servers/McpServerEdit";
import { ProviderList } from "./pages/providers/ProviderList";
import { ProviderEdit } from "./pages/providers/ProviderEdit";
import { ConfigEditor } from "./pages/ConfigEditor";
import { Backup } from "./pages/Backup";
import { Settings } from "./pages/Settings";
import { MetricsPage } from "./pages/MetricsPage";

function App() {
  const workspaceContext = useWorkspaceProvider();

  if (workspaceContext.loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  return (
    <WorkspaceContext.Provider value={workspaceContext}>
      <BrowserRouter>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/metrics" element={<MetricsPage />} />
              <Route path="/skills" element={<SkillList />} />
              <Route path="/skills/new" element={<SkillEdit />} />
              <Route path="/skills/:name" element={<SkillEdit />} />
              <Route path="/commands" element={<CommandList />} />
              <Route path="/commands/new" element={<CommandEdit />} />
              <Route path="/commands/:name" element={<CommandEdit />} />
              <Route path="/agents" element={<AgentList />} />
              <Route path="/agents/new" element={<AgentEdit />} />
              <Route path="/agents/:name" element={<AgentEdit />} />
              <Route path="/mcp-servers" element={<McpServerList />} />
              <Route path="/mcp-servers/new" element={<McpServerEdit />} />
              <Route path="/mcp-servers/:name" element={<McpServerEdit />} />
              <Route path="/providers" element={<ProviderList />} />
              <Route path="/providers/new" element={<ProviderEdit />} />
              <Route path="/providers/:name" element={<ProviderEdit />} />
              <Route path="/config" element={<ConfigEditor />} />
              <Route path="/backup" element={<Backup />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </SidebarInset>
        </SidebarProvider>
      </BrowserRouter>
    </WorkspaceContext.Provider>
  );
}

export default App;
