import { AxiosResponse } from 'axios';

export class GetResultCasesTagsResponse {
    cases: TestCaseTagListDto[];

    constructor(
        private response: AxiosResponse<any, any>,
    ) {
        if (!response || !response.data) {
            throw new Error('Invalid response, no data recieved.');
        }
        this.cases = response.data as TestCaseTagListDto[];
    }

    public toModel(): TestCaseTagListDto[] | undefined {
        return this.cases;
    }
}

export interface TestCaseTagListDto {
    caseId: string;
    fqn: string;
    tags?: string[];
}
