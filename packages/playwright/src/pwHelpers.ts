import crypto from 'crypto';
import path from 'path';
import { CaseResult, ResultStatusEnum, StepResult, SuiteResult } from '@cloudbeat/types';
import { FullProject } from '@playwright/test';
import type { Location, Suite, TestCase, TestResult, TestStep } from '@playwright/test/reporter';
import { v4 as uuidv4 } from 'uuid';

export function getPwSuiteFqn(pwSuite?: Suite): string {
    const { testDir } = pwSuite?.project() || {};
    const fqnParts: string[] = [];

    while (pwSuite) {
        /* eslint-disable no-underscore-dangle */
        // @ts-expect-error access to private property _type
        const pwSuiteType = pwSuite._type;
        /* eslint-enable no-underscore-dangle */

        if (pwSuiteType === 'root' || pwSuiteType === 'project' || !pwSuite.title || pwSuite.title === '') {
            pwSuite = pwSuite.parent;
            continue;
        }

        if (pwSuiteType === 'file') {
            const relativePath = getRelativeLocation(pwSuite.location?.file, testDir);
            if (relativePath) {
                fqnParts.push(relativePath.replace(/\\/g, '/'));
            }
        }
        else {
            fqnParts.push(pwSuite.title);
        }

        pwSuite = pwSuite.parent;
    }

    return fqnParts.reverse().join(':');
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
            const projectName = parentSuite.project()?.name;
            if (projectName) {
                keyParts.push(projectName);
            }
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
        pw: {
            projectName: pwProject.name,
            ...pwProject.use,
        },
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
        testAttributes: pwSuiteType === 'file' ? getSuiteAttributes(project) : {},
        status: ResultStatusEnum.PASSED,
        suites: [],
        cases: [],
        hooks: [],
        _parent: cbParentSuite,
    };
    if (cbParentSuite) {
        cbParentSuite.suites.push(newSuite);
    }
    return newSuite;
}

function getRelativeLocation(filePath: string | undefined, testDir: string | undefined): string | undefined {
    if (testDir && filePath) {
        return path.relative(testDir, filePath).split(path.sep).join('/');
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
        fqn: `${cbParentSuite.fqn || ''}:${pwCase.title}`,
        iterationNum: pwCase.repeatEachIndex + 1,
        location: getCodeLocation(pwCase.location, testDir),
        steps: [],
        _parent: cbParentSuite,
        context: {},
    };
    if (pwCase.parent.project()?.name) {
        newCbCase.context = {
            browserName: pwCase.parent.project()!.name,
        };
    }
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
