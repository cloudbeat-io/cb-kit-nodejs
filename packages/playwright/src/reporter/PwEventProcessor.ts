import path from 'path';
import {
    Attachment,
    AttachmentSubTypeEnum,
    AttachmentTypeEnum,
    CaseResult as CbCaseResult,
    FailureResult as CbFailureResult,
    StepResult as CbStepResult,
    SuiteResult as CbSuiteResult,
    TestResult as CbTestResult,
    FailureReasonEnum,
    ResultStatusEnum,
    StepTypeEnum,
} from '@cloudbeat/types';

import { FullConfig, TestStatus } from '@playwright/test';
import { FullResult, Location, Suite, TestCase, TestError, TestResult, TestStep } from '@playwright/test/reporter';
import { v4 as uuidv4 } from 'uuid';

import { CbReporterClient } from '../clients/CbReporterClient';
import { createCbCaseResult, createCbStepResult, createCbSuiteResult, endCbCaseResult, endCbStepResult, getAttachmentFileNameFromPath, getCodeLocation, getPwSuiteFqn, getPwSuiteKey } from '../pwHelpers';
import { CbReporterOptions } from '../types/CbReporterOptions';


const REPORT_PW_STEP_CATEGORIES = [
    'expect',
    'hook',
    'pw:api',
    'test.step',
];

const UNKNOWN_LOG_LEVEL = '-unknown-';

export class PwEventProcessor {
    // CB run details
    private runId?: string;
    private instanceId?: string;
    private agentId?: string;
    private accountId?: number;
    private userId?: number;
    private locationId?: string;
    private rootDir?: string;
    // holds entire structure of CB result
    private cbRunResult: CbTestResult | null = null;
    private readonly cbSuiteCache = new Map<string, CbSuiteResult>();
    private readonly cbCaseCache = new Map<TestCase, CbCaseResult>();
    private pwRootSuite?: Suite;
    private readonly startTime = (new Date()).getTime();
    private readonly errors: TestError[] = [];
    private readonly startedCases = new Set<TestCase>();
    // counters to help calculate overall test run progress
    private allCasesCount: number = 1;
    private lastCaseOrder: number = 1;

    constructor(
        private cbClient: CbReporterClient,
        private cbReporterOpts: CbReporterOptions,
    ) {
        this.retrieveCbRunOptions();
    }

    public onRunBegin(pwConfig: FullConfig, pwSuite: Suite) {
        this.rootDir = pwConfig.rootDir + path.sep;
        this.pwRootSuite = pwSuite;
        this.allCasesCount = pwSuite.allTests().length;
        this.cbRunResult = this.createRunResult(this.allCasesCount, this._getCapabilities(pwConfig));
        this.cbClient.onRunStart();

        for (const pwTest of pwSuite.allTests()) {
            const cbParentSuite = this.getParentCbSuite(pwTest.parent);
            const cbCase = createCbCaseResult(pwTest, cbParentSuite);
            this.cbCaseCache.set(pwTest, cbCase);
            this.cbClient.onCasePending(cbCase, cbParentSuite);
        }
    }

    public onTestBegin(pwTest: TestCase) {
        const cbCase = this.cbCaseCache.get(pwTest);
        if (!cbCase) {
            return;
        }
        this.startedCases.add(pwTest);
        // @ts-expect-error access to private property _parent
        // eslint-disable-next-line no-underscore-dangle
        const cbParentSuite = cbCase._parent as CbSuiteResult;
        this.cbClient.onCaseStart(cbCase, cbParentSuite);
    }

    public onTestEnd(pwTest: TestCase, pwResult: TestResult) {
        if (!this.cbRunResult || !this.cbCaseCache.has(pwTest)) {
            return;
        }
        const cbCaseResult = this.cbCaseCache.get(pwTest)!;
        // @ts-expect-error access to private property _parent
        // eslint-disable-next-line no-underscore-dangle
        const cbSuiteResult = cbCaseResult._parent as CbSuiteResult;
        const { testDir } = pwTest.parent.project() || {};
        cbCaseResult.status = this._getResultStatusEnum(pwResult.status);
        cbCaseResult.endTime = (new Date()).getTime();
        cbCaseResult.duration = cbCaseResult.endTime - cbCaseResult.startTime;
        cbCaseResult.reRunCount = pwResult.retry;
        // note: this will not work for tests executed on multiple browsers...
        // this.cbRunResult.metadata!.browserName = pwTest.parent.project()!.name;
        // await this._sendIsRunningStatus(test, result);
        // increase order count for the next case report
        this.lastCaseOrder++;

        const failureScreenshot = cbCaseResult.status === ResultStatusEnum.FAILED ? pwResult.attachments.find(a => a.name === 'screenshot') : undefined;
        this.addAttachmentsToCase(cbCaseResult, pwResult.attachments);

        cbCaseResult.steps = this._getCbStepsFromPwSteps(pwResult.steps, testDir, failureScreenshot);
        if (pwResult.status === 'failed' && this._hasNoFailedSteps(cbCaseResult.steps)) {
            cbCaseResult.failure = this._getCbFailureFromPwError(pwResult, testDir);
        }

        // update end-time of the parent suites + update status
        this.endParentSuiteForCase(cbSuiteResult, cbCaseResult.status);

        this.cbClient.onCaseEnd(cbCaseResult, cbSuiteResult);
    }

    public onRunEnd(result: FullResult) {
        // Playwright runs global setup and loads the test files BEFORE it calls onBegin.
        // If any of these fail (or no tests were found, or the test list/grep matched nothing) - onBegin is never called,
        // but onEnd still is. We must still report the (failed) run, otherwise CloudBeat gets no result at all.
        const beganRun = !!this.cbRunResult;
        if (!this.cbRunResult) {
            this.cbClient.connect();
            this.cbRunResult = this.createRunResult(0, {});
        }
        this.cbRunResult.endTime = (new Date()).getTime();
        this.cbRunResult.status = this._getResultStatusEnum(result.status);
        this.cbRunResult.duration = this.cbRunResult.endTime - this.cbRunResult.startTime;

        // nothing below is allowed to prevent the result from being sent
        try {
            this.finalizeUnfinishedCases(result.status);
        }
        catch (e) {
            console.error('[CloudBeat] Failed to finalize unfinished cases:', e);
        }
        this.setRunFailureFromErrors(result.status, beganRun);
        this.removeInternalPropsFromResult();
        try {
            this.reportOnSuiteEnd();
        }
        catch (e) {
            console.error('[CloudBeat] Failed to report suite end:', e);
        }
        this.cbClient.onRunEnd(this.cbRunResult);
    }

    public onStepBegin(test: TestCase, result: TestResult, step: TestStep) {
    }

    public onStepEnd(test: TestCase, result: TestResult, step: TestStep) {
    }

    // errors which are not related to a particular test: global setup/teardown, test loading/syntax errors, worker crashes, etc.
    public onError(error: TestError): void {
        this.errors.push(error);
    }

    public onStdOut(chunk: string | Buffer, pwTest: TestCase | undefined, pwResult: TestResult | undefined) {
        // try to convert stdout chunk to "cb" util's internal event
        try {
            const { type, data, testId } = JSON.parse(String(chunk));
            switch (type) {
                case 'setFailureReason':
                    this.setFailureReason(data.reason as FailureReasonEnum, pwTest);
                    break;
                case 'addTestAttribute':
                    this.addTestAttribute(data.name as string, data.value, pwTest);
                    break;
                case 'addOutputData':
                    this.addOutputData(data.name as string, data.data, pwTest);
                    break;
                case 'addConsoleLog':
                    this.addConsoleLog(data , pwTest);
                    break;
            }
        }
        catch {
            this.addSystemConsoleLog(String(chunk));
        }
    }

    private createRunResult(totalCases: number, capabilities: any): CbTestResult {
        return {
            startTime: this.startTime,
            runId: this.runId!,
            instanceId: this.instanceId!,
            agentId: this.agentId!,
            accountId: this.accountId,
            userId: this.userId,
            locationId: this.locationId!.toString(),
            totalCases,
            metadata: {
                executingUserId: this.userId!,
                accountId: this.accountId!,
                framework: 'Playwright',
                language: 'JavaScript',
            },
            capabilities,
            suites: [],
        };
    }

    // cases which were never reported as finished (e.g. worker crash, global timeout, interrupted run)
    // must not be left without a status
    private finalizeUnfinishedCases(runStatus: FullResult['status']) {
        const now = (new Date()).getTime();
        this.cbCaseCache.forEach((cbCase, pwTest) => {
            if (cbCase.status) {
                return;
            }
            const started = this.startedCases.has(pwTest);
            cbCase.endTime = now;
            cbCase.duration = now - cbCase.startTime;
            if (started) {
                cbCase.status = ResultStatusEnum.FAILED;
                cbCase.failure = {
                    type: 'GENERAL_ERROR',
                    message: `The test did not finish. The test run ended with status '${runStatus}'.`,
                };
            }
            else {
                cbCase.status = ResultStatusEnum.SKIPPED;
            }
            // @ts-expect-error access to private property _parent
            // eslint-disable-next-line no-underscore-dangle
            const cbSuiteResult = cbCase._parent as CbSuiteResult;
            this.endParentSuiteForCase(cbSuiteResult, cbCase.status);
            this.cbClient.onCaseEnd(cbCase, cbSuiteResult);
        });
    }

    // surface errors which are not attached to any test (otherwise the run just shows up as failed with no explanation)
    private setRunFailureFromErrors(runStatus: FullResult['status'], beganRun: boolean) {
        if (!this.cbRunResult) {
            return;
        }
        if (this.errors.length === 0) {
            if (!beganRun && runStatus !== 'passed') {
                this.errors.push({ message: `Playwright finished with status '${runStatus}' before starting the tests. Check that the specified tests exist and that the global setup is working.` });
            }
            else {
                return;
            }
        }
        const messages = this.errors.map(e => stripAscii(e.message || e.value || e.stack || 'Unknown error'));
        const first = this.errors[0];
        // run-level failure is an object (not a string as it is declared in @cloudbeat/types)
        (this.cbRunResult as any).failure = {
            type: beganRun ? 'GENERAL_ERROR' : 'INITIALIZATION_ERROR',
            subtype: this._getPwErrorType(first),
            message: messages.join('\n\n'),
            stacktrace: first.stack ? stripAscii(first.stack) : undefined,
            location: first.location ? getCodeLocation(first.location, undefined) : undefined,
            line: first.location?.line,
            isFatal: !beganRun,
        };
        if (this.cbRunResult.status !== ResultStatusEnum.FAILED) {
            this.cbRunResult.status = ResultStatusEnum.FAILED;
        }
    }

    private reportOnSuiteEnd() {
        this.cbSuiteCache.forEach(cbSuite => {
            this.cbClient.onSuiteEnd(cbSuite);
        });
    }

    private endParentSuiteForCase(cbSuiteResult: any, caseStatus: ResultStatusEnum) {
        cbSuiteResult.endTime = (new Date().getTime());
        cbSuiteResult.duration = cbSuiteResult.endTime - cbSuiteResult.startTime;
        if (caseStatus === ResultStatusEnum.FAILED) {
            cbSuiteResult.status = ResultStatusEnum.FAILED;
        }
        // eslint-disable-next-line no-underscore-dangle
        if (cbSuiteResult._parent) {
            // eslint-disable-next-line no-underscore-dangle
            this.endParentSuiteForCase(cbSuiteResult._parent, caseStatus);
        }
    }

    private addBrowserConsoleLog(message: string, level?: string, pwTest?: TestCase): void {
        if (!message || !pwTest) {
            return;
        }
        if (!this.cbRunResult || !this.cbCaseCache.has(pwTest)) {
            return;
        }
        const cbCaseResult = this.cbCaseCache.get(pwTest)!;
        if (!cbCaseResult.logs) {
            cbCaseResult.logs = [];
        }
        cbCaseResult.logs.push({
            time: new Date().getTime(),
            level: level || UNKNOWN_LOG_LEVEL,
            msg: message,
            src: 'browser',
        });
    }

    private addSystemConsoleLog(message: string, pwTest?: TestCase): void {
        if (!message || !pwTest) {
            return;
        }
        if (!this.cbRunResult || !this.cbCaseCache.has(pwTest)) {
            return;
        }
        const cbCaseResult = this.cbCaseCache.get(pwTest)!;
        if (!cbCaseResult.logs) {
            cbCaseResult.logs = [];
        }
        cbCaseResult.logs.push({
            time: new Date().getTime(),
            level: UNKNOWN_LOG_LEVEL,
            msg: message,
            src: 'user',
        });
    }

    private addConsoleLog(logEntry: any, pwTest?: TestCase): void {
        const { type, message } = logEntry;
        this.addBrowserConsoleLog(message as string, type as string, pwTest);
    }

    private addOutputData(name: string, data: any, pwTest?: TestCase): void {
        if (!name || !data || !pwTest) {
            return;
        }
        if (!this.cbRunResult || !this.cbCaseCache.has(pwTest)) {
            return;
        }
        const cbCaseResult = this.cbCaseCache.get(pwTest)!;
        if (!cbCaseResult.context) {
            cbCaseResult.context = {};
        }
        if (!cbCaseResult.context.resultData) {
            cbCaseResult.context.resultData = [];
        }
        cbCaseResult.context.resultData.push({ Name: name, Data: data });
    }

    private setFailureReason(reason?: FailureReasonEnum, pwTest?: TestCase): void {
        if (!reason || !pwTest) {
            return;
        }
        if (!this.cbRunResult || !this.cbCaseCache.has(pwTest)) {
            return;
        }
        const cbCaseResult = this.cbCaseCache.get(pwTest)!;
        cbCaseResult.failureReasonId = reason;
    }

    private addTestAttribute(name: string, value: any, pwTest?: TestCase): void {
        if (!name || !value || !pwTest) {
            return;
        }
        if (!this.cbRunResult || !this.cbCaseCache.has(pwTest)) {
            return;
        }
        const cbCaseResult = this.cbCaseCache.get(pwTest)!;
        if (!cbCaseResult.testAttributes) {
            cbCaseResult.testAttributes = {};
        }
        cbCaseResult.testAttributes[name] = value;
    }

    private addAttachmentsToCase(cbCaseResult: CbCaseResult, pwAttachments: { name: string; contentType: string; path?: string | undefined; body?: Buffer | undefined }[]) {
        if (!cbCaseResult.attachments) {
            cbCaseResult.attachments = [];
        }
        for (const pwAttachment of pwAttachments) {
            if (!pwAttachment.path) {
                continue;
            }
            if (pwAttachment.name === 'video') {
                const cbAttachment: Attachment = {
                    id: uuidv4(),
                    type: AttachmentTypeEnum.Video,
                    subType: AttachmentSubTypeEnum.Screencast,
                    fileName: getAttachmentFileNameFromPath(pwAttachment.path),
                    filePath: pwAttachment.path,
                };
                cbCaseResult.attachments.push(cbAttachment);
            }
            else if (pwAttachment.name === 'trace') {
                const cbAttachment: Attachment = {
                    id: uuidv4(),
                    type: AttachmentTypeEnum.Other,
                    subType: AttachmentSubTypeEnum.PlaywrightTrace,
                    fileName: getAttachmentFileNameFromPath(pwAttachment.path),
                    filePath: pwAttachment.path,
                };
                cbCaseResult.attachments.push(cbAttachment);
            }
        }
    }

    private removeInternalPropsFromResult() {
        if (this.cbRunResult) {
            this.removeInternalPropsFromSuites(this.cbRunResult.suites);
        }
    }

    private removeInternalPropsFromSuites(suites: CbSuiteResult[]) {
        for (const suiteResult of suites) {
            // @ts-expect-error access to private property _parent
            // eslint-disable-next-line no-underscore-dangle
            if (suiteResult._parent) {
                // @ts-expect-error access to private property _parent
                // eslint-disable-next-line no-underscore-dangle
                delete suiteResult._parent;
            }
            if (suiteResult.cases && suiteResult.cases.length) {
                for (const caseResult of suiteResult.cases) {
                    // @ts-expect-error access to private property _parent
                    // eslint-disable-next-line no-underscore-dangle
                    if (caseResult._parent) {
                        // @ts-expect-error access to private property _parent
                        // eslint-disable-next-line no-underscore-dangle
                        delete caseResult._parent;
                    }
                }
            }
            if (suiteResult.suites && suiteResult.suites.length) {
                this.removeInternalPropsFromSuites(suiteResult.suites);
            }
        }
    }

    private getParentCbSuite(pwSuite: Suite): CbSuiteResult {
        const suiteKey = getPwSuiteKey(pwSuite);
        if (this.cbSuiteCache.has(suiteKey)) {
            return this.cbSuiteCache.get(suiteKey)!;
        }
        let cbParentSuite;
        // create missing suite hierarchy up to spec file suite - ignore root and 'project' suites
        if (pwSuite.parent && pwSuite.parent !== this.pwRootSuite && pwSuite.parent.location) {
            cbParentSuite = this.getParentCbSuite(pwSuite.parent);
        }
        const cbSuite = createCbSuiteResult(pwSuite, cbParentSuite);
        if (!cbParentSuite) {
            this.cbRunResult?.suites.push(cbSuite);
        }
        this.cbSuiteCache.set(suiteKey, cbSuite);
        this.cbClient.onSuiteStart(cbSuite);

        return cbSuite;
    }

    private _getCapabilities(config: FullConfig): any {
        // not suppose to happen
        if (config.projects.length === 0) {
            return {};
        }
        const browserName = config.projects[0].use.browserName || null;
        const channel = config.projects[0].use.channel || null;
        if (browserName === 'chromium') {
            return { browserName: channel };
        }
        else if (browserName) {
            return { browserName };
        }
        return {};
    }

    private _getFileNameFromPath(filePath: string): string {
        const fileName = path.parse(filePath).name;
        // remove .spec suffix, if exists
        return fileName.replace(/\.spec$/, '');
    }

    private addSkippedTests() {
        /* const skippedPwCases = this.suite.allTests().filter((pwCase) => !this.cbCaseCache.has(pwCase));

        skippedPwCases.forEach((pwCase) => {
            this.onTestBegin(pwCase);
            const cbCase = this.cbCaseCache.get(pwCase);
            if (cbCase) {
            cbCase.endTime = cbCase.startTime = (this.startTime || new Date().getTime());
            cbCase.duration = 0;
            cbCase.status = ResultStatusEnum.SKIPPED;
            }
        });*/
    }

    private _hasNoFailedSteps(steps?: CbStepResult[]): boolean {
        if (!steps || !steps.length) {
            return true;
        }
        for (const stepResult of steps) {
            if (stepResult.status === ResultStatusEnum.FAILED) {
                return false;
            }
            if (!this._hasNoFailedSteps(stepResult.steps)) {
                return false;
            }
        }
        return true;
    }

    private _getCbStepsFromPwSteps(steps: TestStep[], testDir?: string, failureScreenshot?: { name: string; path?: string; body?: Buffer; contentType: string }): CbStepResult[] {
        return steps.filter(s => REPORT_PW_STEP_CATEGORIES.includes(s.category)).map((pwStep: TestStep) => {
            const childSteps = this._getCbStepsFromPwSteps(pwStep.steps, testDir, pwStep.error ? undefined : failureScreenshot);

            const childStepFailed = childSteps.some((x) => x.status === ResultStatusEnum.FAILED);

            const cbStep: CbStepResult = {
                id: uuidv4(),
                // _category: pwStep.category,
                startTime: new Date(pwStep.startTime).getTime(),
                endTime: new Date(pwStep.startTime).getTime() + pwStep.duration,
                duration: pwStep.duration,
                name: pwStep.title,
                location: pwStep.location ? getCodeLocation(pwStep.location, testDir) : undefined,
                type: this._getCbStepTypeFromPwCategory(pwStep.category),
                status: pwStep.error || childStepFailed ? ResultStatusEnum.FAILED : ResultStatusEnum.PASSED,
                failure: this._getCbFailureFromPwError(pwStep, testDir),
                // FIXME: we can probably need to convert the inline screenshot to an attachment to reduce the payload size
                // screenShot: pwStep.error && failureScreenshot ? this._getBase64FromScreeenshot(failureScreenshot) : undefined,
                steps: childSteps,
                attachments: [],
            };
            if (pwStep.error && failureScreenshot) {
                const cbAttachment: Attachment = {
                    id: uuidv4(),
                    type: AttachmentTypeEnum.Screenshot,
                    subType: AttachmentSubTypeEnum.Screenshot,
                    fileName: getAttachmentFileNameFromPath(failureScreenshot.path!),
                    filePath: failureScreenshot.path,
                };
                cbStep.attachments!.push(cbAttachment);
            }
            return cbStep;
        });
    }

    private _getCbStepTypeFromPwCategory(category: string): StepTypeEnum {
        switch (category) {
            case 'expect':
                return StepTypeEnum.ASSERTION;
            case 'hook':
                return StepTypeEnum.HOOK;
            case 'test.step':
                return StepTypeEnum.TRANSACTION;
        }
        return StepTypeEnum.GENERAL;
    }

    private _getCbFailureFromPwError(pwStepOrTest?: TestStep | TestResult, testDir?: string): CbFailureResult | undefined {
        if (!pwStepOrTest || !pwStepOrTest.error) {
            return undefined;
        }
        const { error } = pwStepOrTest;
        const message = error.message && stripAscii(error.message);
        let stack = error.stack && stripAscii(error.stack);
        if (stack && message && stack.startsWith(message)) {
            stack = stack.substr(message.length);
            stack = stack.replaceAll(this.rootDir as string, '');
        }
        return {
            type: this._getCbFailureTypeForPwError(pwStepOrTest),
            subtype: this._getPwErrorType(error),
            snippet: error.snippet,
            message: message,
            stacktrace: stack,
            location: error.location ? getCodeLocation(error.location, testDir) : undefined,
            line: error.location?.line,
        };
    }

    private _getCbFailureTypeForPwError(pwStepOrCase: TestStep | TestResult): string {
        if ('category' in pwStepOrCase && pwStepOrCase.category === 'expect') {
            return 'ASSERT_ERROR';
        }
        else if (pwStepOrCase.error?.message?.indexOf('TimeoutError:') === 0) {
            return 'TIMEOUT_ERROR';
        }
        else if ('status' in pwStepOrCase && pwStepOrCase.status === 'timedOut') {
            return 'TIMEOUT_ERROR';
        }
        return 'GENERAL_ERROR';
    }

    private _getPwErrorType(error: TestError): string {
        const matches = error.message?.match(/^(.+?):/);
        if (!matches || matches.length < 2) {
            return 'Error';
        }
        return matches[1];
    }

    private _getResultStatusEnum(status: 'passed' | 'failed' | 'timedout' | 'interrupted' | TestStatus): ResultStatusEnum {
        if (status === 'passed') {
            return ResultStatusEnum.PASSED;
        }
        else if (status === 'skipped') {
            return ResultStatusEnum.SKIPPED;
        }
        else {
            return ResultStatusEnum.FAILED;
        }
    }

    private retrieveCbRunOptions() {
        if (!process.env.CB_RUN_ID) {
            throw new Error('CB_RUN_ID is required');
        }
        if (!process.env.CB_INSTANCE_ID) {
            throw new Error('CB_INSTANCE_ID is required');
        }
        if (!process.env.CB_AGENT_ID) {
            throw new Error('CB_AGENT_ID is required');
        }
        if (!process.env.CB_ACCOUNT_ID) {
            throw new Error('CB_ACCOUNT_ID is required');
        }
        if (!process.env.CB_LOCATION_ID) {
            throw new Error('CB_LOCATION_ID is required');
        }
        this.runId = process.env.CB_RUN_ID;
        this.instanceId = process.env.CB_INSTANCE_ID;
        this.agentId = process.env.CB_AGENT_ID;
        this.accountId = parseInt(process.env.CB_ACCOUNT_ID, 10);
        // CB_USER_ID could be undefined if test was executed by scheduler
        if (process.env.CB_USER_ID) {
            this.userId = parseInt(process.env.CB_USER_ID, 10);
        }
        this.locationId = process.env.CB_LOCATION_ID;
    }

}

const asciiRegex = new RegExp(
    '[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)|(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))', // eslint-disable-line no-control-regex
    'g',
);

const stripAscii = (str: string): string => {
    return str.replace(asciiRegex, '');
};
