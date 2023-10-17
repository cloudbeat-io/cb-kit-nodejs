import { RunInstanceCaseStatus } from './RunInstanceCaseStatus';
import { RunStatusEnum } from './RunStatusEnum';

export interface RunStatusInfo {
    runId: string;
    instanceId: string;
    agentId: string;
    accountId?: number;
    userId?: number;
    status: RunStatusEnum;
    progress: number;
    case: RunInstanceCaseStatus | null;
}
