import { RunStatus } from '@cloudbeat/types';
import Debug from 'debug';
import { CbApiError } from '../base/CbApiError';
import { ApiBaseClientV1 } from './ApiBaseClientV1';
import { GetRunResponse } from './dto/runtime/GetRunResponse';
import * as V1_API_ENDPOINTS from './endpoints';

const debug = Debug('RuntimeApi');
const error = Debug('RuntimeApi:error');

export class RuntimeApi extends ApiBaseClientV1 {
    constructor(
        apiToken: string,
        apiHostUrl?: string,
    ) {
        super(apiToken, apiHostUrl);
    }

    public async runTestCase(caseId: number, options?: RunOptions): Promise<string | null> {
        const path = `${V1_API_ENDPOINTS.CASES}/${caseId}/run`;
        try {
            const response = await this.instance.post(path, options);
            if (!response.data || !response.data.id) {
                throw new CbApiError('Invalid response, "data.id" is missing.');
            }
            return response.data.id;
        }
        catch (e: any) {
            // if HTTP 404 recieved, then return null to indicate that test case was not found
            if (e.response && e.response.status && e.response.status === 404) {
                return null;
            }
            error(e);
            throw new CbApiError(e);
        }
    }

    public async runTestSuite(suiteId: number, options?: RunOptions): Promise<string | null> {
        const path = `${V1_API_ENDPOINTS.SUITES}/${suiteId}/run`;
        try {
            const response = await this.instance.post(path, options);
            if (!response.data || !response.data.id) {
                throw new CbApiError('Invalid response, "data.id" is missing.');
            }
            return response.data.id;
        }
        catch (e: any) {
            // if HTTP 404 recieved, then return null to indicate that test case was not found
            if (e.response && e.response.status && e.response.status === 404) {
                return null;
            }
            error(e);
            throw new CbApiError(e);
        }
    }

    public async runMonitor(monitorId: string, options?: RunOptions): Promise<string | null> {
        const path = `${V1_API_ENDPOINTS.MONITORS}/${monitorId}/run`;
        try {
            const response = await this.instance.post(path, options);
            if (!response.data || !response.data.id) {
                throw new CbApiError('Invalid response, "data.id" is missing.');
            }
            return response.data.id;
        }
        catch (e: any) {
            // if HTTP 404 recieved, then return null to indicate that test case was not found
            if (e.response && e.response.status && e.response.status === 404) {
                return null;
            }
            error(e);
            throw new CbApiError(e);
        }
    }

    public async getRunStatus(runId: string): Promise<RunStatus> {
        const path = `${V1_API_ENDPOINTS.RUNS}/${runId}`;
        try {
            const response = await this.instance.get(path);
            if (!response.data) {
                throw new CbApiError('Invalid response, no data recieved.');
            }
            return new GetRunResponse(response).toModel();
        }
        catch (e: any) {
            error(e);
            throw new CbApiError(e);
        }
    }
}

export type RunOptions = {
    testAttributes?: { [key: string]: any };
    additionalParameters?: { [key: string]: any };
    environmentId?: number;
    environmentName?: string;
    releaseName?: string;
    sprintName?: string;
    buildName?: string;
    pipelineName?: string;
    projectName?: string;
    testName?: string;
};
