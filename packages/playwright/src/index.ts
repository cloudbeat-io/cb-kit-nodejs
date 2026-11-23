import { CaseResult, StepResult, SuiteResult } from '@cloudbeat/types';
import type { FullConfig, TestStatus } from '@playwright/test';
import type { FullResult, Reporter, Suite, TestCase, TestError, TestResult, TestStep } from '@playwright/test/reporter';
import { CbReporterClient } from './clients/CbReporterClient';
import { LocalReporterClient } from './clients/LocalReporterClient';
import { RemoteReporterClient } from './clients/RemoteReporterClient';
import { createCbCaseResult, createCbStepResult, createCbSuiteResult, endCbCaseResult, endCbStepResult } from './pwHelpers';
import { PwEventProcessor } from './reporter/PwEventProcessor';
import { CbReporterOptions } from './types/CbReporterOptions';

const diffEndRegexp = /-((expected)|(diff)|(actual))\.png$/;
const stepAttachRegexp = /^allureattach_(\w{8}-\w{4}-\w{4}-\w{4}-\w{12})_/i;
// 12 (allureattach) + 1 (_) + 36 (uuid v4) + 1 (_)
const stepAttachPrefixLength = 50;

export default class CbReporter implements Reporter {
    config!: FullConfig;
    suite!: Suite;
    resultsDir!: string;
    options: CbReporterOptions;

    private readonly isRunningInCbAgent = process.env.CB_AGENT && process.env.CB_AGENT === 'true' ? true : false;
    private serverUrl = process.env.CB_AGENT_SERVER_URL;
    private readonly client: CbReporterClient;

    private readonly cbSuiteCache = new Map<Suite, SuiteResult>();
    private readonly cbCaseCache = new Map<TestCase, CaseResult>();
    private readonly cbStepCache = new Map<TestStep, StepResult>();
    private cbRootSuite?: SuiteResult;
    private startTime?: number;
    private readonly eventProcessor?: PwEventProcessor;

    private processedDiffs: string[] = [];

    constructor(options: CbReporterOptions) {
        this.options = options;
        if (!this.serverUrl && options.serverUrl) {
            this.serverUrl = options.serverUrl;
        }
        if (this.isRunningInCbAgent) {
            this.client = new LocalReporterClient();
        }
        else {
            this.client = new RemoteReporterClient(this.serverUrl);
        }
        // the below will throw an error if we are not running in CB
        try {
            this.eventProcessor = new PwEventProcessor(this.client, options);
        }
        // so just ignore all PW events if we are not running in CB
        catch (e: any) {
            // ... but if we are running in a CB agent - it's a problem, and we must not stay silent about it
            if (this.isRunningInCbAgent) {
                console.error(`[CloudBeat] The reporter is disabled, test results will not be reported: ${e?.message || e}`);
            }
        }
    }

    onBegin(pwConfig: FullConfig, pwSuite: Suite): void {
        if (!this.eventProcessor) {
            return;
        }
        this.client.connect();
        this.eventProcessor.onRunBegin(pwConfig, pwSuite);
    }

    onTestBegin(pwTest: TestCase): void {
        if (!this.eventProcessor) {
            return;
        }
        this.eventProcessor.onTestBegin(pwTest);
    }

    onStepBegin(pwTest: TestCase, _result: TestResult, pwStep: TestStep): void {
        /* const cbParentCase = this.cbCaseCache.get(pwTest);
        if (!cbParentCase) {
            return;
        }
        if (pwStep.category !== 'test.step' && pwStep.category !== 'expect') {
            return;
        }
        const pwParentStep = pwStep.parent;
        const cbParentStep = pwParentStep && this.cbStepCache.has(pwParentStep) ?
            this.cbStepCache.get(pwParentStep) : undefined;
        const cbStep = createCbStepResult(pwStep, cbParentCase, cbParentStep);
        this.cbStepCache.set(pwStep, cbStep);
        this.client.onStepStart(cbStep);*/
    }

    onStepEnd(_test: TestCase, _result: TestResult, pwStep: TestStep): void {
        /* const cbStep = this.cbStepCache.get(pwStep);
        if (!cbStep) {
            return;
        }
        if (pwStep.category !== 'test.step') {
            return;
        }
        endCbStepResult(pwStep, cbStep);
        this.client.onStepEnd(cbStep);*/
    }

    onTestEnd(pwTest: TestCase, pwResult: TestResult): void {
        if (!this.eventProcessor) {
            return;
        }
        /* const cbCase = this.cbCaseCache.get(pwTest);
        if (!cbCase) {
            return;
        }
        */
        // We need to check parallelIndex first because pw introduced this field only in v1.30.0
        const threadId = pwResult.parallelIndex !== undefined ? pwResult.parallelIndex : pwResult.workerIndex;

        /* const thread: string =
            process.env.ALLURE_THREAD_NAME || `${this.hostname}-${process.pid}-playwright-worker-${threadId}`;*/

        /* for (const attachment of result.attachments) {
            await this.processAttachment(attachment, allureTest, runtime);
        }*/

        if (pwResult.stdout.length > 0) {
            /* allureTest.addAttachment(
            "stdout",
            "text/plain",
            runtime.writeAttachment(stripAscii(result.stdout.join("")), "text/plain"),
            );*/
        }

        if (pwResult.stderr.length > 0) {
            /* allureTest.addAttachment(
            "stderr",
            "text/plain",
            runtime.writeAttachment(stripAscii(result.stderr.join("")), "text/plain"),
            );*/
        }
        // endCbCaseResult(pwTest, pwResult, cbCase);
        this.eventProcessor.onTestEnd(pwTest, pwResult);
    }


    // NOTE: onEnd must be async. Playwright awaits it before it exits, which gives us the chance
    // to make sure that the run result is delivered to the agent.
    async onEnd(pwResult: FullResult): Promise<void> {
        if (!this.eventProcessor) {
            return;
        }
        try {
            this.eventProcessor.onRunEnd(pwResult);
        }
        catch (e) {
            console.error('[CloudBeat] Failed to report the run result:', e);
        }
        await this.client.flush();
    }

    onError(pwError: TestError): void {
        if (!this.eventProcessor) {
            return;
        }
        this.eventProcessor.onError(pwError);
    }

    onStdOut(chunk: string | Buffer, pwTest?: TestCase, pwResult?: TestResult): void {
        if (!this.eventProcessor) {
            return;
        }
        this.eventProcessor.onStdOut(chunk, pwTest, pwResult);
    }

    printsToStdio(): boolean {
        return false;
    }
}

export * from './cbUtils';
