import { FailureResult } from '../results/FailureResult';
import { ResultStatusEnum } from '../results/ResultStatusEnum';
import { RunStatusEnum } from './RunStatusEnum';

export interface SuiteStatusUpdateReq {
    timestamp: number;
    runId: string;
    instanceId: string;
    id: string;
    fqn?: string;
    parentFqn?: string;
    parentId?: string;
    parentName?: string;
    name: string;
    displayName?: string;
    startTime?: number;
    endTime?: number;
    runStatus: RunStatusEnum;
    testStatus?: ResultStatusEnum;
    failures?: FailureResult[];
    standardOutput?: string;
    errorOutput?: string;
    framework?: string;
    language?: string;
}
