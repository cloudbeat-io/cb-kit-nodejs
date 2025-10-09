import { CaseResult, StepResult, SuiteResult, TestResult } from '@cloudbeat/types';

export interface CbReporterClient {
    connect(): void;

    onRunStart(): void;
    onRunEnd(testResult?: TestResult): void;

    onSuiteStart(cbSuite: SuiteResult): void;
    onSuiteEnd(cbSuite: SuiteResult): void;

    onCaseStart(cbCase: CaseResult, cbParentSuite: SuiteResult): void;
    onCaseEnd(cbCase: CaseResult, cbParentSuite: SuiteResult): void;

    onStepStart(cbStep: StepResult): void;
    onStepEnd(cbStep: StepResult): void;
}
