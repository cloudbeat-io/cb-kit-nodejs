import crypto from 'crypto';
import path from 'path';
import { CaseResult, StepResult, SuiteResult } from '@cloudbeat/types';
import { FullProject } from '@playwright/test';
import type { Location, Reporter, Suite, TestCase, TestError, TestResult, TestStep } from '@playwright/test/reporter';
import { v4 as uuidv4 } from 'uuid';

export function getPwSuiteFqn(pwSuite?: Suite): string {
    const { testDir } = pwSuite?.project() || {};
    const fqnParts: string[] = [];
    while (pwSuite) {
        // @ts-expect-error access to private property _type
        // eslint-disable-next-line no-underscore-dangle
        const pwSuiteType = pwSuite._type;
        if (!pwSuite.location || !pwSuite.title || pwSuite.title === '') {
            pwSuite = pwSuite.parent;
            continue;
        }
        if (pwSuiteType === 'file') {
            fqnParts.push(getRelativeLocation(pwSuite.location.file, testDir)!);
        }
        else {
            fqnParts.push(getTitleBasedFqn(pwSuite.title));
        }
        pwSuite = pwSuite.parent;
    }
    return fqnParts.reverse().join('#');
}

export function getPwSuiteKey(pwSuite: Suite): string {
    const { testDir } = pwSuite.project() || {};
    const keyParts: string[] = [];
    // @ts-expect-error access to private property _type
    // eslint-disable-next-line no-underscore-dangle
    const pwSuiteType = pwSuite._type;
    const includeProjectName = !(pwSuiteType === 'file');
    let parentSuite: Suite | undefined = pwSuite;
    while (parentSuite) {
        // @ts-expect-error access to private property _type
        // eslint-disable-next-line no-underscore-dangle
        const parentSuiteType = parentSuite._type;
        if ((!parentSuite.location && !includeProjectName) || !parentSuite.title || parentSuite.title === '') {
            parentSuite = parentSuite.parent;
            continue;
        }
        if (parentSuiteType === 'file') {
            keyParts.push(getRelativeLocation(parentSuite.location?.file, testDir)!);
        }
        else {
            keyParts.push(getTitleBasedFqn(parentSuite.title));
        }
        parentSuite = parentSuite.parent;
    }
    return keyParts.reverse().join('#');
}

function getSuiteAttributes(pwProject?: FullProject): {[key: string]: any} {
    if (!pwProject) {
        return {};
    }
    const attributes = {
        pw: pwProject.use,
        browserName: pwProject.use.browserName || pwProject.use.defaultBrowserType || pwProject.use.channel,
        resolution: pwProject.use.viewport,
    };

    return attributes;
}

export function createCbSuiteResult(pwSuite: Suite, cbParentSuite?: SuiteResult): SuiteResult {
    const project = pwSuite.project();
    const { testDir } = project || {};
    // @ts-expect-error access to private property _type
    // eslint-disable-next-line no-underscore-dangle
    const pwSuiteType = pwSuite._type;
    const newSuite = {
        id: uuidv4(),
        name: pwSuite.title,
        startTime: (new Date().getTime()),
        fqn: getPwSuiteFqn(pwSuite),
        iterationNum: 1,
        location: getRelativeLocation(pwSuite.location?.file, testDir),
        testAttributes: pwSuiteType !== 'file' ? getSuiteAttributes(project) : {},
        suites: [],
        cases: [],
        hooks: [],
    };
    if (cbParentSuite) {
        cbParentSuite.suites.push(newSuite);
    }
    return newSuite;
}

function getRelativeLocation(filePath: string | undefined, testDir: string | undefined): string | undefined {
    if (testDir && filePath) {
        const fqnSegments = path.relative(testDir, filePath).split(path.sep);
        const nativePathSegments = testDir.split(path.sep);
        const testDirName = nativePathSegments[nativePathSegments.length-1];
        fqnSegments.unshift(testDirName);
        return fqnSegments.join('\\');
    }
    return filePath;
}

export function getCodeLocation(location: Location, testDir: string | undefined): string {
    const relativePath = getRelativeLocation(location.file, testDir);
    if (relativePath) {
        return `${relativePath}:${location.line}:${location.column}`;
    }
    return `${location.file}:${location.line}:${location.column}`;
}

function getTitleBasedFqn(title: string) {
    return crypto.createHash('shake256', { outputLength: 4 })
      .update(title)
      .digest('hex');
}

export function createCbCaseResult(pwCase: TestCase, cbParentSuite: SuiteResult): CaseResult {
    const { testDir } = pwCase.parent.project() || {};
    const newCbCase = {
        id: uuidv4(),
        name: pwCase.title,
        startTime: (new Date().getTime()),
        fqn: `${cbParentSuite.fqn || ''}#${getTitleBasedFqn(pwCase.title)}`,
        iterationNum: 1,
        location: getCodeLocation(pwCase.location, testDir),
        steps: [],
        _parent: cbParentSuite,
    };
    cbParentSuite.cases.push(newCbCase);
    return newCbCase;
}

export function createCbStepResult(pwStep: TestStep, cbParentCase: CaseResult, cbParentStep?: StepResult): StepResult {
    throw new Error('Method not implemented.');
}

export function endCbStepResult(pwStep: TestStep, cbStep: StepResult): void {
    // cbStep.status = pwStep.error ? Status.FAILED : Status.PASSED;
    throw new Error('Method not implemented.');
}

export function endCbCaseResult(pwCase: TestCase, pwResult: TestResult, cbCase: CaseResult): void {

}

export function getAttachmentFileNameFromPath(filePath: string): string {
    return path.basename(filePath);
}
