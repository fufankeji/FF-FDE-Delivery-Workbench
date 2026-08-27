import { Navigate, Route, Routes, useParams } from "react-router-dom";

import { AppShell } from "../components/AppShell";
import { ArtifactsPage } from "../pages/ArtifactsPage";
import { ArchitecturePage } from "../pages/ArchitecturePage";
import { ChatPage } from "../pages/ChatPage";
import { DataPage } from "../pages/DataPage";
import { ExplorePage } from "../pages/ExplorePage";
import { HomePage } from "../pages/HomePage";
import { ModelPage } from "../pages/ModelPage";
import { SettingsPage } from "../pages/SettingsPage";
import { SkillsPage } from "../pages/SkillsPage";
import { SourcesPage } from "../pages/SourcesPage";

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<HomePage />} />
        <Route path="data" element={<DataPage />} />
        <Route path="architecture" element={<ArchitecturePage />} />
        <Route path="projects/:projectId/chat" element={<ChatPage />} />
        <Route path="projects/:projectId/sources" element={<SourcesPage />} />
        <Route path="projects/:projectId/explore" element={<ExplorePage />} />
        <Route path="projects/:projectId/models" element={<ModelPage />} />
        <Route path="projects/:projectId/artifacts" element={<ArtifactsPage />} />
        <Route path="projects/:projectId/reports" element={<ProjectReportRedirect />} />
        <Route path="skills" element={<SkillsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="appearance" element={<Navigate to="/settings" replace />} />
        <Route path="design-system" element={<Navigate to="/settings" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function ProjectReportRedirect() {
  const { projectId = "" } = useParams();
  return <Navigate to={`/projects/${projectId}/chat?panel=report`} replace />;
}
