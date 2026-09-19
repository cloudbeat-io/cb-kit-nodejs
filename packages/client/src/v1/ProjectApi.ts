import Debug from 'debug';
import FormData from 'form-data';
import { CbApiError } from '../base/CbApiError';
import { ApiBaseClientV1 } from './ApiBaseClientV1';
import { ProjectSyncStatus } from './dto/project/GetSyncStatusResponse';
import * as V1_API_ENDPOINTS from './endpoints';

const error = Debug('RuntimeApi:error');

export class ProjectApi extends ApiBaseClientV1 {
    constructor(
        apiToken: string,
        apiHostUrl?: string,
    ) {
        super(apiToken, apiHostUrl);
    }

    public async uploadArtifacts(projectId: string, fileName: string, fileContent: Buffer): Promise<any> {
        const path = `${V1_API_ENDPOINTS.PROJECTS}/sync/artifacts/${projectId}/`;

        try {
            const formData = new FormData();
            formData.append('file', fileContent, { filename: fileName });
            const response = await this.instance.post(
                path,
                formData,
                {
                    headers: formData.getHeaders(),
                },
            );
            if (response.data) {
                return response.data;
            }
        }
        catch (e: any) {
            error(e);
            throw new CbApiError(e as Error);
        }
    }

    public async getSyncStatus(projectId: string): Promise<ProjectSyncStatus> {
        const path = `${V1_API_ENDPOINTS.PROJECTS}/${projectId}/sync/status`;
        try {
            const response: any = await this.instance.get(path);
            const status = response?.data ?? response;
            if (!status) {
                throw new CbApiError('Invalid response, no data recieved.');
            }
            return new ProjectSyncStatus(status);
        }
        catch (e: any) {
            error(e);
            throw new CbApiError(e as Error);
        }
    }

    public async list(): Promise<ProjectInfo[]> {
        const path = `${V1_API_ENDPOINTS.PROJECTS}/list/details`;
        try {
            const response: any = await this.instance.get(path);
            const projects = response?.data ?? response;
            if (!Array.isArray(projects)) {
                throw new CbApiError('Invalid response, project list expected.');
            }
            return projects as ProjectInfo[];
        }
        catch (e: any) {
            error(e);
            throw new CbApiError(e as Error);
        }
    }

    public async create(project: CreateProjectRequest, fileName?: string, fileContent?: Buffer): Promise<number> {
        try {
            const formData = new FormData();
            formData.append('data', JSON.stringify(project), { contentType: 'application/json' });
            if (fileName && fileContent) {
                formData.append('file', fileContent, { filename: fileName });
            }
            const response: any = await this.instance.post(
                V1_API_ENDPOINTS.PROJECTS,
                formData,
                {
                    headers: formData.getHeaders(),
                },
            );
            const id = response?.data?.id ?? response?.id;
            if (id === undefined) {
                throw new CbApiError('Invalid response, project id expected.');
            }
            return id as number;
        }
        catch (e: any) {
            error(e);
            throw new CbApiError(e as Error);
        }
    }

    public async triggerSync(projectId: string): Promise<void> {
        const path = `${V1_API_ENDPOINTS.PROJECTS}/${projectId}/sync`;
        try {
            await this.instance.post(path);
        }
        catch (e: any) {
            error(e);
            throw new CbApiError(e as Error);
        }
    }
}

export type ProjectSyncType = 'Manual' | 'None' | 'Git';

export interface ProjectInfo {
    id: number;
    name: string;
    type: string;
}

export interface ProjectGitSettings {
    url: string;
    branchName?: string;
    userName?: string;
    password?: string;
    token?: string;
}

export interface CreateProjectRequest {
    name: string;
    type: string;
    notes?: string;
    settings: {
        type: string;
        syncType: ProjectSyncType;
        execCommand?: string;
        execOptions?: string;
        assemblyNames?: string;
        preExecCommands?: string[];
        postExecCommands?: string[];
    };
    gitSettings?: ProjectGitSettings;
}
