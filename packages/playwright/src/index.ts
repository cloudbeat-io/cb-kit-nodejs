import { CaseResult, ResultStatusEnum, StepResult, SuiteResult } from '@cloudbeat/types';
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
    private readonly eventProcessor: PwEventProcessor;

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
        this.eventProcessor = new PwEventProcessor(this.client, options);
    }

    onBegin(pwConfig: FullConfig, pwSuite: Suite): void {
        this.client.connect();
        this.eventProcessor.onRunBegin(pwConfig, pwSuite);
    }

    onTestBegin(pwTest: TestCase): void {
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


    onEnd(pwResult: FullResult): void {
        // this.addSkippedTests();
        // this.client.onEnd(this.cbRootSuite);
        this.eventProcessor.onRunEnd(pwResult);
        /* for (const group of this.allureGroupCache.values()) {
            group.endGroup();
        }*/
    }

    printsToStdio(): boolean {
        return false;
    }

    private getParentCbSuite(pwSuite: Suite): SuiteResult {
        if (this.cbSuiteCache.has(pwSuite)) {
            return this.cbSuiteCache.get(pwSuite)!;
        }
        let cbParentSuite;
        if (pwSuite.parent) {
            cbParentSuite = this.getParentCbSuite(pwSuite.parent);
        }
        const cbSuite = createCbSuiteResult(pwSuite, cbParentSuite);
        this.cbSuiteCache.set(pwSuite, cbSuite);
        return cbSuite;
    }
}
