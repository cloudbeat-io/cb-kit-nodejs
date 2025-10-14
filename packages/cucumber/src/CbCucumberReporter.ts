import { v2 } from '@cloudbeat/client';
import {
    CaseResult as CbCaseResult,
    StepResult as CbStepResult,
    SuiteResult as CbSuiteResult,
    TestResult as CbTestResult,
    ResultStatusEnum,
    RunStatusEnum,
    StepTypeEnum,
} from '@cloudbeat/types';
import { CaseStatusUpdateReq } from '@cloudbeat/types';
import { Formatter } from '@cucumber/cucumber';
import StepDefinition from '@cucumber/cucumber/lib/models/step_definition';
import { FRAMEWORK_NAME, LANGUAGE_NAME } from './const';
import { Attachment, Envelope, GherkinDocument, Pickle, ReporterOptions, TestCase, TestCaseFinished, TestCaseStarted, TestRunFinished, TestRunHookStarted, TestRunStarted, TestStats, TestStepFinished, TestStepStarted } from './types';
import {
    addAttachmentsOnTestCaseFinished,
    addPlaywrightStepsAndScreenshotFromAttachments,
    determineTestCaseStatus,
    generateId,
    generateResultFile,
    getFailureFromException,
    getFailureFromMessage,
    getGherkinStepExtraType,
    getResultFilePath,
} from './utils';

class CbCucumberReporter extends Formatter {
    private readonly options: ReporterOptions;
    private stats: TestStats = {
        scenarios: { total: 0, passed: 0, failed: 0, skipped: 0 },
        steps: { total: 0, passed: 0, failed: 0, skipped: 0, pending: 0 },
    };
    private cbTestResult?: CbTestResult;
    // Track which pickles are accepted for execution
    private acceptedPickleIds = new Set();
    private parsedGherkinDocumentMap: Map<string, GherkinDocument> = new Map();
    private parsedPickleMap: Map<string, Pickle> = new Map();
    private parsedTestCaseMap: Map<string, TestCase> = new Map();
    private parsedStepDefinitionMap: Map<string, StepDefinition> = new Map();
    private startedTestCaseMap: Map<string, TestCaseStarted> = new Map();
    private startedCbSuiteMap: Map<string, CbSuiteResult> = new Map();
    private startedCbCaseMap: Map<string, CbCaseResult> = new Map();
    private pendingCbCaseMap: Map<string, CbCaseResult> = new Map();
    private startedCbStepMap: Map<string, CbStepResult> = new Map();
    private attachmentsByTestStepIdMap: Map<string, any> = new Map();
    private attachmentsByTestCaseIdMap: Map<string, any> = new Map();
    private testCaseIterationCounter: Map<string, number> = new Map();
    private runId?: string;
    private instanceId?: string;
    private agentId?: string;
    private resultFilePath?: string;
    private cbApiClient?: v2.RuntimeApi;

    constructor(options: ReporterOptions) {
        super(options);

        console.log('ℹ️ CbCucumberReporter - constructor');
        this.options = options;
        // Check if we are running inside CB agent
        if (process.env.CB_AGENT
            && process.env.CB_AGENT === 'true'
            && (options.runId || process.env.CB_RUN_ID)
            && (options.instanceId || process.env.CB_INSTANCE_ID)
            && (options.agentId || process.env.CB_AGENT_ID)
        ) {
            console.log('ℹ️ CbCucumberReporter - start initializing');
            this.runId = options.runId || process.env.CB_RUN_ID;
            this.instanceId = options.instanceId || process.env.CB_INSTANCE_ID;
            this.agentId = options.agentId || process.env.CB_AGENT_ID;
            this.resultFilePath = getResultFilePath(options.outputDir);
            // Initialize CB test result object
            this.cbTestResult = {
                startTime: (new Date()).getTime(),
                runId: this.runId!,
                instanceId: this.instanceId!,
                agentId: this.agentId!,
                suites: [],
                metadata: {
                    framework: 'Cucumber',
                    language: 'JavaScript',
                },
            };
            this.setupEventListeners();
            const apiUrl = process.env.CB_TEST_MONITOR_URL;
            const apiToken = process.env.CB_TEST_MONITOR_TOKEN;
            this.runId = process.env.CB_RUN_ID;
            this.instanceId = process.env.CB_INSTANCE_ID;
            if (apiUrl && apiToken && this.runId && this.instanceId) {
                this.cbApiClient = new v2.RuntimeApi(apiUrl, apiToken);
            }
            console.log('ℹ️ CbCucumberReporter - initialized');
        }
    }

    private setupEventListeners(): void {
        this.options.eventBroadcaster.on('envelope', this.handleEnvelope.bind(this));
    }

    private async handleEnvelope(envelope: Envelope): Promise<void> {
        // Handle different event types
        if (envelope.testRunStarted) {
            this.onTestRunStarted(envelope.testRunStarted);
        }
        else if (envelope.testRunFinished) {
            this.onTestRunFinished(envelope.testRunFinished);
        }
        else if (envelope.testCase) {
            this.onTestCase(envelope.testCase);
        }
        else if (envelope.gherkinDocument) {
            this.onGherkinDocument(envelope.gherkinDocument);
        }
        else if (envelope.pickle) {
            this.onPickle(envelope.pickle);
        }
        else if (envelope.attachment) {
            this.onAttachment(envelope.attachment);
        }
        else if (envelope.stepDefinition) {
            this.parsedStepDefinitionMap.set(envelope.stepDefinition.id, envelope.stepDefinition);
        }
        else if (envelope.testCaseStarted) {
            await this.onTestCaseStarted(envelope.testCaseStarted);
        }
        else if (envelope.testCaseFinished) {
            await this.onTestCaseFinished(envelope.testCaseFinished);
        }
        else if (envelope.testStepStarted) {
            this.onTestStepStarted(envelope.testStepStarted);
        }
        else if (envelope.testStepFinished) {
            this.onTestStepFinished(envelope.testStepFinished);
        }
        else {
            if ((envelope as any).meta || (envelope as any).source || (envelope as any).hook || (envelope as any).attachment) {
                return;
            }
        }
    }

    private async onTestCase(testCase: TestCase) {
        console.log('ℹ️ onTestCase');
        this.acceptedPickleIds.add(testCase.pickleId);
        this.parsedTestCaseMap.set(testCase.id, testCase);
        // new part below
        const pickle = this.parsedPickleMap.get(testCase.pickleId);
        if (!pickle) {
            return;
        }
        const gherkinDocument = this.parsedGherkinDocumentMap.get(pickle.uri);
        if (!gherkinDocument) {
            return;
        }
        const fqn = `${pickle.uri}:${pickle.name}`;
        const cbCaseResult: CbCaseResult = {
            id: generateId(),
            name: pickle.name,
            startTime: 0,
            fqn,
            iterationNum: -1,
            reRunCount: 0,
            steps: [],
        };
        this.pendingCbCaseMap.set(testCase.id, cbCaseResult);
        const cbParentSuite = this.startedCbSuiteMap.get(gherkinDocument.uri);
        await this.sendCaseStatus(cbCaseResult, RunStatusEnum.Pending, cbParentSuite);
    }

    private onGherkinDocument(gherkinDocument: GherkinDocument) {
        if (!gherkinDocument.feature || !gherkinDocument.uri) {
            return;
        }
        this.parsedGherkinDocumentMap.set(gherkinDocument.uri, gherkinDocument);
        const cbSuite: CbSuiteResult = {
            id: generateId(),
            name: gherkinDocument.feature?.name,
            startTime: (new Date()).getTime(),
            duration: 0,
            fqn: gherkinDocument.uri,
            status: ResultStatusEnum.SKIPPED,
            iterationNum: 1,
            suites: [],
            hooks: [],
            cases: [],
        };
        // We assume at discovery stage that a feature file will be ignored
        // We later assign a proper endTime and status to the suites that were actually executed
        cbSuite.endTime = cbSuite.startTime;
        this.startedCbSuiteMap.set(gherkinDocument.uri, cbSuite);
        this.cbTestResult!.suites.push(cbSuite);
    }

    private onPickle(pickle: Pickle): void {
        this.parsedPickleMap.set(pickle.id, pickle);
    }

    private onAttachment(attachment: Attachment) {
        const { testStepId, testCaseStartedId } = attachment;
        if (testStepId) {
            if (!this.attachmentsByTestStepIdMap.has(testStepId)) {
                this.attachmentsByTestStepIdMap.set(testStepId, []);
            }
            const attachments = this.attachmentsByTestStepIdMap.get(testStepId);
            attachments.push(attachment);
        }
        if (testCaseStartedId) {
            if (!this.attachmentsByTestCaseIdMap.has(testCaseStartedId)) {
                this.attachmentsByTestCaseIdMap.set(testCaseStartedId, []);
            }
            const attachments = this.attachmentsByTestCaseIdMap.get(testCaseStartedId);
            attachments.push(attachment);
        }
    }

    private onTestRunStarted(testRunStarted: TestRunStarted): void {
        console.log('ℹ️ onTestRunStarted');
        // Override startTime, as the original one is incorrect due to object being initialized in the constructor
        this.cbTestResult!.startTime = (new Date()).getTime();
    }

    private onTestRunFinished(testRunFinished: TestRunFinished): void {
        console.log('ℹ️ onTestRunFinished');
        if (!this.cbTestResult) {
            return;
        }
        this.cbTestResult.endTime = (new Date()).getTime();
        this.cbTestResult.duration = this.cbTestResult.endTime - this.cbTestResult.startTime;
        // Calculate final status
        const hasFailures = this.stats.scenarios.failed > 0 || this.stats.steps.failed > 0;
        this.cbTestResult.status = testRunFinished.success === false || hasFailures
            ? ResultStatusEnum.FAILED : ResultStatusEnum.PASSED;
        generateResultFile(this.cbTestResult, this.resultFilePath!);

        // Exit with appropriate code
        if (testRunFinished.success === false || hasFailures) {
            console.log('❌ Test run completed with failures');
        }
        else {
            console.log('✅ Test run completed successfully');
        }
    }

    private async onTestCaseStarted(testCaseStarted: TestCaseStarted): Promise<void> {
        console.log('ℹ️ onTestCaseStarted');
        const testCase = this.parsedTestCaseMap.get(testCaseStarted.testCaseId);
        if (!testCase) {
            return;
        }
        const pickle = this.parsedPickleMap.get(testCase.pickleId);
        if (!pickle) {
            return;
        }
        const gherkinDocument = this.parsedGherkinDocumentMap.get(pickle.uri);
        if (!gherkinDocument) {
            return;
        }
        this.startedTestCaseMap.set(testCaseStarted.id, testCaseStarted);
        const fqn = `${pickle.uri}:${pickle.name}`;
        // retrieve or update iterations counter
        let iterationNum = this.testCaseIterationCounter.get(fqn) || 0;
        // if this is a retry run, keep the iteration number same
        if (!testCaseStarted.attempt) {
            iterationNum++;
        }
        this.testCaseIterationCounter.set(fqn, iterationNum);
        const cbCaseResult = this.pendingCbCaseMap.get(testCase.id);
        if (cbCaseResult) {
            this.pendingCbCaseMap.delete(testCase.id);
        }
        /* const cbCaseResult: CbCaseResult = {
            id: generateId(),
            name: pickle.name,
            startTime: (new Date()).getTime(),
            fqn,
            iterationNum,
            reRunCount: testCaseStarted.attempt,
            steps: [],
        }; */
        const cbParentSuite = this.startedCbSuiteMap.get(gherkinDocument.uri);
        if (!cbParentSuite || !cbCaseResult) {
            return;
        }
        cbCaseResult.startTime = (new Date()).getTime();
        cbCaseResult.reRunCount = testCaseStarted.attempt;
        cbCaseResult.iterationNum = iterationNum;
        // Adjust startTime of the parent suite, if this is the first test case executed within the suite
        if (cbParentSuite.duration === 0) {
            cbParentSuite.startTime = cbCaseResult.startTime;
            cbParentSuite.endTime = undefined;
            cbParentSuite.duration = undefined;
            cbParentSuite.status = ResultStatusEnum.PASSED;
        }
        cbParentSuite.cases.push(cbCaseResult);
        this.startedCbCaseMap.set(testCaseStarted.id, cbCaseResult);
        await this.sendCaseStatus(cbCaseResult, RunStatusEnum.Running, cbParentSuite);
    }

    private async onTestCaseFinished(testCaseFinished: TestCaseFinished): Promise<void> {
        console.log('ℹ️ onTestCaseFinished');
        const cbCaseResult = this.startedCbCaseMap.get(testCaseFinished.testCaseStartedId);
        if (!cbCaseResult) {
            return;
        }
        const startedTestCase = this.startedTestCaseMap.get(testCaseFinished.testCaseStartedId);
        if (!startedTestCase) {
            return;
        }
        const testCase = this.parsedTestCaseMap.get(startedTestCase.testCaseId);
        if (!testCase) {
            return;
        }

        const pickle = this.parsedPickleMap.get(testCase.pickleId);
        if (!pickle) {
            return;
        }

        const gherkinDoc = this.parsedGherkinDocumentMap.get(pickle.uri);
        if (!gherkinDoc) {
            return;
        }
        // Get parent CB suite
        const cbParentSuite = this.startedCbSuiteMap.get(gherkinDoc.uri);
        if (!cbParentSuite) {
            return;
        }
        cbCaseResult.endTime = (new Date()).getTime();
        cbCaseResult.duration = cbCaseResult.endTime - cbCaseResult.startTime;
        // Adjust parent suite endTime and duration
        cbParentSuite.endTime = cbCaseResult.endTime;
        cbParentSuite.duration = cbParentSuite.endTime - cbParentSuite.startTime;
        // Add screenshots and PW events that were added post-step-finished
        const attachments = this.attachmentsByTestCaseIdMap.get(testCaseFinished.testCaseStartedId);
        if (attachments) {
            addAttachmentsOnTestCaseFinished(
                testCaseFinished.testCaseStartedId, cbCaseResult, this.startedCbStepMap, attachments);
        }
        // Free up memory
        this.attachmentsByTestCaseIdMap.delete(testCaseFinished.testCaseStartedId);
        const cukeResult = testCaseFinished.result;
        if (cukeResult) {
            cbCaseResult.status = cukeResult.status === 'FAILED' ? ResultStatusEnum.FAILED : ResultStatusEnum.PASSED;
            if (cukeResult.message) {
                cbCaseResult.failure = {
                    type: 'CUCUMBER_ERROR',
                    message: cukeResult.message,
                };
            }
        }
        else {
            cbCaseResult.status = determineTestCaseStatus(cbCaseResult);
        }
        // Adjust parent suite status if the current test case has failed
        if (cbCaseResult.status === ResultStatusEnum.FAILED) {
            cbParentSuite.status = ResultStatusEnum.FAILED;
        }
        await this.sendCaseStatus(cbCaseResult, RunStatusEnum.Finished, cbParentSuite);
    }

    private onTestStepStarted(testStepStarted: TestStepStarted): void {
        const startedTestCase = this.startedTestCaseMap.get(testStepStarted.testCaseStartedId);
        if (!startedTestCase) {
            return;
        }
        const cbCaseResult = this.startedCbCaseMap.get(testStepStarted.testCaseStartedId);
        if (!cbCaseResult) {
            return;
        }
        const testCase = this.parsedTestCaseMap.get(startedTestCase.testCaseId);
        if (!testCase) {
            return;
        }

        const pickle = this.parsedPickleMap.get(testCase.pickleId);
        if (!pickle) {
            return;
        }
        if (!testStepStarted.testStepId) {
            return;
        }
        const testCaseStartedStep = testCase.testSteps.find(step => step.id === testStepStarted.testStepId);
        if (!testCaseStartedStep?.stepDefinitionIds || !testCaseStartedStep.stepDefinitionIds.length) {
            return;
        }
        const pickleStepId = testCaseStartedStep.pickleStepId;
        const pickleStep = pickle.steps.find(step => step.id === pickleStepId);
        if (!pickleStep) {
            return;
        }
        const cbStepResult: CbStepResult = {
            id: generateId(),
            name: pickleStep.text,
            type: StepTypeEnum.GHERKIN,
            startTime: (new Date()).getTime(),
            fqn: `${cbCaseResult.fqn}:${pickleStep.text}`,
            location: pickleStep.locations && pickleStep.locations.length ? `${pickle.uri}:${pickleStep.locations[0].line}` : undefined,
            extra: {
                gherkin: {
                    type: getGherkinStepExtraType(pickleStep.type),
                },
            },
            steps: [],
        };
        cbCaseResult.steps?.push(cbStepResult);
        this.startedCbStepMap.set(testStepStarted.testStepId, cbStepResult);
    }

    private onTestStepFinished(testStepFinished: TestStepFinished): void {
        const { testStepResult, testStepId, testCaseStartedId } = testStepFinished;
        const cbStepResult = this.startedCbStepMap.get(testStepId);
        if (!cbStepResult) {
            return;
        }
        const attachments = this.attachmentsByTestStepIdMap.get(testStepId);
        cbStepResult.endTime = (new Date()).getTime();
        cbStepResult.duration = cbStepResult.endTime - cbStepResult.startTime!;
        cbStepResult.status = ResultStatusEnum.PASSED;
        // Add additional steps if provided in the attachments (like in case of Playwright integration)
        addPlaywrightStepsAndScreenshotFromAttachments(cbStepResult, attachments);
        // Determine step status
        if (testStepResult && testStepResult.status === 'FAILED') {
            cbStepResult.status = ResultStatusEnum.FAILED;
            if (testStepResult.exception) {
                cbStepResult.failure = getFailureFromException(testStepResult.exception);
            }
            else if (testStepResult.message) {
                cbStepResult.failure = getFailureFromMessage(testStepResult.message);
            }
        }
    }

    private async sendCaseStatus(
        cbCaseResult: CbCaseResult,
        runStatus: RunStatusEnum,
        cbParentSuite?: CbSuiteResult,
    ): Promise<void> {
        if (this.cbApiClient) {
            try {
                console.log('ℹ️ Trying to send runtime status...');
                await this.cbApiClient.updateCaseStatus({
                    timestamp: new Date().getTime(),
                    runId: this.runId!,
                    instanceId: this.instanceId!,
                    id: cbCaseResult.id,
                    fqn: cbCaseResult.fqn,
                    parentFqn: cbParentSuite?.fqn,
                    parentId: cbParentSuite?.id,
                    parentName: cbParentSuite?.name,
                    name: cbCaseResult.name,
                    startTime: cbCaseResult.startTime > 0 ? cbCaseResult.startTime : undefined,
                    endTime: cbCaseResult.endTime,
                    runStatus,
                    testStatus: cbCaseResult.status,
                    framework: FRAMEWORK_NAME,
                    language: LANGUAGE_NAME,
                });
                console.log('ℹ️ Runtime status sent');
            }
            catch(e) {
                // Ignore
                console.log('❌ Failed to send runtime status:', e);
            }
        }
    }

    private getStatusInfo(status: string): { status: string; emoji: string } {
        switch (status) {
            case 'PASSED':
                return { status: 'PASSED', emoji: '✅' };
            case 'FAILED':
                return { status: 'FAILED', emoji: '❌' };
            case 'SKIPPED':
                return { status: 'SKIPPED', emoji: '⏭️' };
            case 'PENDING':
                return { status: 'PENDING', emoji: '⏳' };
            default:
                return { status, emoji: '❓' };
        }
    }

    private updateScenarioStats(status: string): void {
        switch (status) {
            case 'PASSED':
                this.stats.scenarios.passed++;
                break;
            case 'FAILED':
                this.stats.scenarios.failed++;
                break;
            case 'SKIPPED':
                this.stats.scenarios.skipped++;
                break;
        }
    }

    private updateStepStats(status: string): void {
        switch (status) {
            case 'PASSED':
                this.stats.steps.passed++;
                break;
            case 'FAILED':
                this.stats.steps.failed++;
                break;
            case 'SKIPPED':
                this.stats.steps.skipped++;
                break;
            case 'PENDING':
                this.stats.steps.pending++;
                break;
        }
    }
}

export default CbCucumberReporter;


