import { Attachment } from './Attachment';
import { FailureResult } from './FailureResult';
import { LogResult } from './LogResult';
import { ResultStatusEnum } from './ResultStatusEnum';
import { StepResult } from './StepResult';

export interface CaseResult {
    id: string;
    fqn: string;
    name: string;
    location?: string;
    startTime: number;
    endTime?: number;
    duration?: number;
    iterationNum: number;
    order?: number;
    status?: ResultStatusEnum;
    failure?: FailureResult;
    failureReasonId?: number;
    reRunCount?: number;
    context?: any;
    logs?: LogResult[];
    steps?: StepResult[];
    hooks?: StepResult[];
    testAttributes?: {[key: string]: any};
    har?: {[key: string]: string};
    attachments?: Attachment[];
}
