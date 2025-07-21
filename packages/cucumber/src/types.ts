import { EventEmitter } from 'events';
import { IFormatterOptions } from '@cucumber/cucumber';
import StepDefinition from '@cucumber/cucumber/lib/models/step_definition';

export interface Envelope {
    testRunStarted?: TestRunStarted;
    testRunFinished?: TestRunFinished;
    testRunHookStarted?: TestRunHookStarted;
    testRunHookFinished?: TestRunHookFinished;
    testCaseStarted?: TestCaseStarted;
    testCaseFinished?: TestCaseFinished;
    testStepStarted?: TestStepStarted;
    testStepFinished?: TestStepFinished;
    gherkinDocument?: GherkinDocument;
    testCase?: TestCase;
    pickle?: Pickle;
    stepDefinition?: StepDefinition;
    attachment?: Attachment;
}

// Supporting types

export interface Attachment {
    /** Arbitrary, application-defined per-attachment ID (Cucumber links attachments to steps via this property) */
    testCaseStartedId?: string;
    testStepId?: string;
    /**
     * The binary or text data of the attachment,
     * encoded as a base64 string for binary data,
     * or raw string for text content
     */
    body: string;
    /**
     * The [MIME type](https://www.iana.org/assignments/media-types/media-types.xhtml) of the attachment (e.g. 'image/png', 'text/plain')
     */
    mediaType: string;
    /** If the attachment is base64-encoded, this should be true; otherwise false or omitted */
    contentEncoding?: 'IDENTITY' | 'BASE64';
    /** Human-readable description (optional) */
    fileName?: string;
    /** Optional: URL reference (for external storage scenarios) */
    source?: string;
}

export interface TestRunHookStarted {
    id: string;                  // Unique ID for this started hook instance
    hookId: string;              // The static definition ID of the hook
    testRunStartedId: string;    // ID of the test run this hook belongs to
    timestamp: {
        seconds: number;
        nanos: number;
    };
}

export interface TestRunHookFinished {
    testRunHookStartedId: string;  // Reference to the started hook event
    result: {
        status: 'UNKNOWN' | 'PASSED' | 'SKIPPED' | 'PENDING' | 'UNDEFINED' | 'AMBIGUOUS' | 'FAILED';
        duration?: {
            seconds: number;
            nanos: number;
        };
        message?: string;            // Error/failure message if any
    };
    timestamp: {
        seconds: number;
        nanos: number;
    };
}

export interface TestCaseLocation {
    line: number;
    column: number;
}

export interface TestCaseTag {
    name: string;
    location: TestCaseLocation;
}

export interface TestStep {
    id: string;
    pickleStepId?: string; // Only for steps that map to a Gherkin step (not hooks)
    hookId?: string;       // Only for hook steps (undefined for regular steps)
    stepDefinitionIds?: string[];
}

export interface TestCase {
    id: string;
    pickleId: string;
    testSteps: TestStep[];
    tags: TestCaseTag[];
}

export interface GherkinDocumentLocation {
    line: number;
    column: number;
}

export interface GherkinTag {
    name: string;
    location: GherkinDocumentLocation;
}

export interface GherkinStep {
    location: GherkinDocumentLocation;
    keyword: string;
    text: string;
    docString?: {
        location: GherkinDocumentLocation;
        contentType?: string;
        content: string;
    };
    dataTable?: {
        location: GherkinDocumentLocation;
        rows: {
            location: GherkinDocumentLocation;
            cells: {
                location: GherkinDocumentLocation;
                value: string;
            }[];
        }[];
    };
}

export interface GherkinScenarioExample {
    location: GherkinDocumentLocation;
    tags: GherkinTag[];
    keyword: string;
    name: string;
    description: string;
    tableHeader: {
        location: GherkinDocumentLocation;
        cells: {
            location: GherkinDocumentLocation;
            value: string;
        }[];
    };
    tableBody: {
        location: GherkinDocumentLocation;
        cells: {
            location: GherkinDocumentLocation;
            value: string;
        }[];
    }[];
}

export interface GherkinScenario {
    location: GherkinDocumentLocation;
    tags: GherkinTag[];
    keyword: string;
    name: string;
    description: string;
    steps: GherkinStep[];
    examples?: GherkinScenarioExample[];
}

export interface GherkinFeatureChild {
    scenario?: GherkinScenario;
    // background?, rule? etc. could be added here
}

export interface GherkinFeature {
    location: GherkinDocumentLocation;
    tags: GherkinTag[];
    language: string;
    keyword: string;
    name: string;
    description: string;
    children: GherkinFeatureChild[];
}

export interface GherkinComment {
    location: GherkinDocumentLocation;
    text: string;
}

export interface GherkinDocument {
    uri: string;
    feature?: GherkinFeature;
    comments?: GherkinComment[];
}

// Supporting types
interface PickleLocation {
    line: number;
    column: number;
}

interface PickleTag {
    name: string;
    location: PickleLocation;
}

interface PickleStepArgument {
    // Can be expanded to DocString or DataTable if handling those
}

export interface PickleStep {
    id: string;
    text: string;
    type: string;
    arguments: PickleStepArgument[];
    locations: PickleLocation[];
}

export interface Pickle {
    id: string;
    uri: string;
    name: string;
    language: string;
    steps: PickleStep[];
    tags: PickleTag[];
    locations: PickleLocation[];
}

export interface TestRunStarted {
    timestamp: {
        seconds: number;
        nanos: number;
    };
}

export interface TestRunFinished {
    timestamp: {
        seconds: number;
        nanos: number;
    };
    success: boolean;
}

export interface TestCaseStarted {
    id: string;
    testCaseId: string;
    attempt: number;
    timestamp: {
        seconds: number;
        nanos: number;
    };
}

export interface TestCaseFinished {
    testCaseStartedId: string;
    timestamp: {
        seconds: number;
        nanos: number;
    };
    result: TestResult;
}

export interface TestStepStarted {
    testCaseStartedId: string;
    testStepId?: string;
    hookId?: string;
    timestamp: {
        seconds: number;
        nanos: number;
    };
}

export interface TestStepFinished {
    testCaseStartedId: string;
    testStepId: string;
    testStepResult: {
        status: 'PASSED' | 'FAILED' | 'SKIPPED' | 'PENDING' | 'UNDEFINED';
        message: string;
        exception: {
            type: string;
            message: string;
            stackTrace: string;
        };
    };
    timestamp: {
        seconds: number;
        nanos: number;
    };
    result: TestResult;
}

export interface TestResult {
    status: 'PASSED' | 'FAILED' | 'SKIPPED' | 'PENDING' | 'UNDEFINED';
    duration?: {
        seconds: number;
        nanos: number;
    };
    message?: string;
}

export interface TestStats {
    scenarios: {
        total: number;
        passed: number;
        failed: number;
        skipped: number;
    };
    steps: {
        total: number;
        passed: number;
        failed: number;
        skipped: number;
        pending: number;
    };
}

export interface ParsedTestCase {
    pickle: {
        id: string;
        name: string;
        steps: {
            id: string;
            text: string;
        }[];
    };
    gherkinDocument: {
        feature: {
            name: string;
        };
    };
}

export interface ReporterOptions extends IFormatterOptions {
    eventBroadcaster: EventEmitter;
    parsedTestCaseMap: { [key: string]: ParsedTestCase };
    runId?: string;
    instanceId?: string;
    agentId?: string;
    outputDir?: string;
}
