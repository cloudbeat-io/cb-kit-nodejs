import { CaseResult } from './CaseResult';
import { FailureResult } from './FailureResult';
import { ResultStatusEnum } from './ResultStatusEnum';
import { StepResult } from './StepResult';

export interface SuiteResult {
    id: string;
    fqn?: string;
    name: string;
    location?: string;
    startTime: number;
    endTime?: number;
    duration?: number;
    iterationNum: number;
    status?: ResultStatusEnum;
    failure?: FailureResult;
    cases: CaseResult[];
    suites: SuiteResult[];
    hooks: StepResult[];
    testAttributes?: {[key: string]: any};
}
