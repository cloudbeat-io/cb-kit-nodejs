import { RunInstanceCaseStatus } from './RunInstanceCaseStatus';
import { RunStatusEnum } from './RunStatusEnum';

export interface RunInstanceStatus {
    id: string;
    runId: string;
    startTime: number;
    endTime?: number;
    pendingDuration: number;
    initializingStartTime: number;
    initializingDuration: number;
    runningStartTime?: number;
    runningDuration?: number;
    status: RunStatusEnum;
    statusLastUpdate: number;
    progress: number;
    casesStatus: RunInstanceCaseStatus[];
    capabilities: { [key: string]: any };
    browserName?: string;
    browserVersion?: string;
    deviceName?: string;
    locationName: string;
    outputLog?: string;
}
