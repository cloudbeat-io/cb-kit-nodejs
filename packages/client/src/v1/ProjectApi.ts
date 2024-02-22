import Debug from 'debug';
import FormData from 'form-data';
import { CbApiError } from '../base/CbApiError';
import { ApiBaseClientV1 } from './ApiBaseClientV1';
import { GetSyncStatusResponse, ProjectSyncStatus } from './dto/project/GetSyncStatusResponse';
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
            const response = await this.instance.get(path);
            if (!response.data) {
                throw new CbApiError('Invalid response, no data recieved.');
            }
            return new GetSyncStatusResponse(response).toModel();
        }
        catch (e: any) {
            error(e);
            throw new CbApiError(e as Error);
        }
    }
}
