import Debug from 'debug';
import { CbApiError } from '../base/CbApiError';
import { sleep } from '../helpers';
import { ApiBaseClientV1 } from './ApiBaseClientV1';
import * as V1_API_ENDPOINTS from './endpoints';
import { GetResultCasesTagsResponse, TestCaseTagListDto } from './dto/result/GetResultCasesTagsResponse';

const error = Debug('RuntimeApi:error');
const RESULT_PULLING_RETRIES = 10;
const RESULT_PULLING_INTERVAL_INCREASE = 1000;

export class ResultApi extends ApiBaseClientV1 {
    constructor(
        apiToken: string,
        apiHostUrl?: string,
    ) {
        super(apiToken, apiHostUrl);
    }

    public async getResultByRunId(runId: string): Promise<any> {
        const path = `${V1_API_ENDPOINTS.RESULTS}/run/${runId}`;
        // pull test results if HTTP 202 Accepted is recieved
        // HTTP 202 means the results are not ready yet,
        // so we need to pull the end-point until HTTP 200 with the result is received
        let delayTime = 1000;
        for (let r=0; r<RESULT_PULLING_RETRIES; r++) {
            try {
                const response = await this.instance.get(path);
                if (response.data) {
                    return response.data;
                }
            }
            catch (e: any) {
                // if HTTP 404 recieved, then return null to indicate that test case was not found
                if (e.response && e.response.status && e.response.status === 404) {
                    return null;
                }
                else if (e.response && e.response.status && e.response.status !== 202) {
                    error(e);
                    throw new CbApiError(e);
                }
            }
            await sleep(delayTime);
            // increase delay interval between pulling attempts
            delayTime += RESULT_PULLING_INTERVAL_INCREASE;
        }
        return null;
    }

    public async getResultTestCasesTagsByRunId(runId: string): Promise<TestCaseTagListDto[] | undefined> {
        const path = `${V1_API_ENDPOINTS.RESULTS}/run/${runId}/cases/tags`;
        try {
            const response = await this.instance.get(path);
            if (!response.data) {
                throw new CbApiError('Invalid response, no data recieved.');
            }
            return new GetResultCasesTagsResponse(response).toModel();
        }
        catch (e: any) {
            error(e);
            throw new CbApiError(e);
        }
    }
}