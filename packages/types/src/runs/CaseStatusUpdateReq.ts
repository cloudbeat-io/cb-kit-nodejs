import { FailureResult } from '../results/FailureResult';
import { ResultStatusEnum } from '../results/ResultStatusEnum';
import { RunStatusEnum } from './RunStatusEnum';

export interface CaseStatusUpdateReq {
    timestamp: number;
    runId: string;
    instanceId: string;
    id: string;
    fqn: string;
    parentFqn: string;
    parentId?: string;
    name: string;
    displayName?: string;
    order?: number;
    iterationNum?: number;
    capabilities?: { [key: string]: any };
    startTime: number;
    endTime?: number;
    progress?: number;
    runStatus: RunStatusEnum;
    testStatus?: ResultStatusEnum;
    reRunCount?: number;
    failureReason?: string;
    failures?: FailureResult[];
    standardOutput?: string;
    errorOutput?: string;
    framework?: string;
    language?: string;
}
