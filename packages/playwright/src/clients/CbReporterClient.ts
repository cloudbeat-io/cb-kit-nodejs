import { CaseResult, StepResult, TestResult } from '@cloudbeat/types';

export interface CbReporterClient {
    connect(): void;

    onRunStart(): void;
    onRunEnd(testResult?: TestResult): void;

    onCaseStart(cbCase: CaseResult): void;
    onCaseEnd(cbCase: CaseResult): void;

    onStepStart(cbStep: StepResult): void;
    onStepEnd(cbStep: StepResult): void;
}
