import { LogResult } from './LogResult';
import { ResultStatusEnum } from './ResultStatusEnum';
import { StepResult } from './StepResult';

export interface CaseResult {
    id: string;
    fqn?: string;
    name: string;
    location?: string;
    startTime: number;
    endTime?: number;
    duration?: number;
    iterationNum: number;
    order?: number;
    status?: ResultStatusEnum;
    reRunCount?: number;
    context?: any;
    logs?: LogResult[];
    steps?: StepResult[];
    har?: {[key: string]: string};
}
