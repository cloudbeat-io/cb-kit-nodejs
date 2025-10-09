import { CaseStatusUpdateReq, RunStatusInfo, SuiteStatusUpdateReq, TestResult } from '@cloudbeat/types';
import Debug from 'debug';
import { ApiBaseClientV2 } from './ApiBaseClientV2';

const debug = Debug('RuntimeApi');
const error = Debug('RuntimeApi:error');

export class RuntimeApi extends ApiBaseClientV2 {
    constructor(
        apiHostUrl: string,
        apiToken: string,
    ) {
        super(apiHostUrl, apiToken);
    }

    // testresult/run
    public async addInstanceResult(runId: string, instanceId: string, result: TestResult) {
        const path = `/testresult/run/${runId}/instance/${instanceId}`;
        try {
            await this.instance.post(path, result);
        }
        catch (e: any) {
            console.error('Failed to post new test results', e);
        }
    }

    // status
    public async updateInstanceStatus(status: RunStatusInfo) {
        const path = '/status';
        try {
            await this.instance.post(path, status);
        }
        catch (e: any) {
            console.error('Failed to update run status', e);
        }
    }

    // runtime/run/{runId}/instance/{instanceId}/case/status
    public async updateCaseStatus(status: CaseStatusUpdateReq) {
        const path = `/runtime/run/${status.runId}/instance/${status.instanceId}/case/status`;
        try {
            await this.instance.post(path, status);
        }
        catch (e: any) {
            console.error('Failed to update case runtime status', e);
        }
    }

    // runtime/run/{runId}/instance/{instanceId}/suite/status
    public async updateSuiteStatus(status: SuiteStatusUpdateReq) {
        const path = `/runtime/run/${status.runId}/instance/${status.instanceId}/suite/status`;
        try {
            await this.instance.post(path, status);
        }
        catch (e: any) {
            console.error('Failed to update suite runtime status', e);
        }
    }
}
