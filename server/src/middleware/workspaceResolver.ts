import { Request, Response, NextFunction } from "express";
import { WorkspaceService } from "../services/WorkspaceService";
import { LocalConfigProvider } from "../services/LocalConfigProvider";
import { ConfigProvider } from "../services/ConfigProvider";
import { AppError } from "./errorHandler";

declare global {
  namespace Express {
    interface Request {
      workspace?: {
        id: string;
        name: string;
        configPath: string;
        provider: ConfigProvider;
      };
    }
  }
}

const workspaceService = new WorkspaceService();

export async function workspaceResolver(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const { workspaceId } = req.params;
  if (!workspaceId) {
    return next(new AppError("MISSING_WORKSPACE_ID", "Workspace ID required", 400));
  }

  const workspace = await workspaceService.get(workspaceId);
  if (!workspace) {
    return next(new AppError("WORKSPACE_NOT_FOUND", `Workspace '${workspaceId}' not found`, 404));
  }

  const provider = new LocalConfigProvider(workspace.configPath);

  try {
    const exists = await provider.exists(".");
    if (!exists) {
      return next(
        new AppError("WORKSPACE_UNREACHABLE", `Config path '${workspace.configPath}' is not accessible`, 503)
      );
    }
  } catch {
    return next(
      new AppError("WORKSPACE_UNREACHABLE", `Config path '${workspace.configPath}' is not accessible`, 503)
    );
  }

  req.workspace = {
    id: workspace.id,
    name: workspace.name,
    configPath: workspace.configPath,
    provider,
  };

  next();
}
