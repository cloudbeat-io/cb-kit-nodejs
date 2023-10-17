import { ResultStatusEnum } from './ResultStatusEnum';
import { SuiteResult } from './SuiteResult';

export interface TestResult {
    startTime: number;
    endTime?: number;
    duration?: number;
    runId: string;
    instanceId: string;
    accountId?: number;
    userId?: number;
    locationId?: string;
    agentId: string;
    status?: ResultStatusEnum;
    options?: any;
    capabilities?: {[key: string]: string | number | object};
    metadata?: {[key: string]: string | number};
    testAttributes?: {[key: string]: string | number | object};
    environmentVaribales?: {[key: string]: string | number};
    totalCases?: number;
    failure?: string;
    suites: SuiteResult[];
}
