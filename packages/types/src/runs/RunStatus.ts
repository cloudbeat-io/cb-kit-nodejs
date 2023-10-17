import { EntityTypeEnum } from '../common/EntityTypeEnum';
import { RunInstanceStatus } from './RunInstanceStatus';
import { RunStatusEnum } from './RunStatusEnum';

export interface RunStatus {
    runId: string;
    entityId: number;
    entityType: EntityTypeEnum;
    runName: string;
    resultId: number;
    startTime: number;
    endTime?: number;
    duration?: number;
    status: RunStatusEnum;
    progress: number;
    statusLastUpdate: number;
    executingUserName: string;
    executingUserId: number;
    projectName: string;
    projectId?: number;
    instances: RunInstanceStatus[];
}
