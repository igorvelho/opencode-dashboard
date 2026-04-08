import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { WorkspaceContext, useWorkspaceProvider } from "./hooks/useWorkspace";
import { SidebarProvider, SidebarInset } from "./components/ui/sidebar";
import { AppSidebar } from "./components/layout/Sidebar";

// Placeholder pages
const Dashboard = () => <div className="p-8"><h1 className="text-2xl font-bold">Dashboard</h1></div>;
const SkillList = () => <div className="p-8"><h1 className="text-2xl font-bold">Skills</h1></div>;
const SkillEdit = () => <div className="p-8"><h1 className="text-2xl font-bold">Edit Skill</h1></div>;
const CommandList = () => <div className="p-8"><h1 className="text-2xl font-bold">Commands</h1></div>;
const CommandEdit = () => <div className="p-8"><h1 className="text-2xl font-bold">Edit Command</h1></div>;
const AgentList = () => <div className="p-8"><h1 className="text-2xl font-bold">Agents</h1></div>;
const AgentEdit = () => <div className="p-8"><h1 className="text-2xl font-bold">Edit Agent</h1></div>;
const McpServerList = () => <div className="p-8"><h1 className="text-2xl font-bold">MCP Servers</h1></div>;
const McpServerEdit = () => <div className="p-8"><h1 className="text-2xl font-bold">Edit MCP Server</h1></div>;
const ProviderList = () => <div className="p-8"><h1 className="text-2xl font-bold">Providers</h1></div>;
const ProviderEdit = () => <div className="p-8"><h1 className="text-2xl font-bold">Edit Provider</h1></div>;
const ConfigEditor = () => <div className="p-8"><h1 className="text-2xl font-bold">Config Editor</h1></div>;
const Backup = () => <div className="p-8"><h1 className="text-2xl font-bold">Backup & Restore</h1></div>;
const Settings = () => <div className="p-8"><h1 className="text-2xl font-bold">Settings</h1></div>;

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
