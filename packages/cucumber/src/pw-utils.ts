import { World } from '@cucumber/cucumber';

// Track methods configuration (should match reporter config)
const CAPTURE_METHODS = [
    'goto', 'click', 'fill', 'type', 'press', 'waitForSelector',
    'waitForTimeout', 'evaluate', 'locator',
    'getByText', 'getByRole', 'getByTestId', 'getByPlaceholder',
    'selectOption', 'check', 'uncheck', 'hover', 'focus', 'blur',
    'waitFor', 'getAttribute',
] as const;

type TrackMethod = typeof CAPTURE_METHODS[number];

function shouldCaptureMethod(method: string): method is TrackMethod {
    return (CAPTURE_METHODS as readonly string[]).includes(method);
}

function shouldCaptureExpectationMethod(method: string): boolean {
    const captureMethods = [
        // Jest/Jasmine matchers
        'toBe', 'toEqual', 'toStrictEqual', 'toBeTruthy', 'toBeFalsy', 'toBeNull',
        'toBeUndefined', 'toBeDefined', 'toContain', 'toHaveLength', 'toMatch',
        'toThrow', 'toHaveBeenCalled', 'toHaveBeenCalledWith', 'toHaveBeenCalledTimes',

        // Playwright matchers
        'toBeVisible', 'toBeHidden', 'toBeEnabled', 'toBeDisabled', 'toBeEditable',
        'toBeEmpty', 'toBeChecked', 'toBeFocused', 'toContainText', 'toHaveAttribute',
        'toHaveClass', 'toHaveCSS', 'toHaveId', 'toHaveJSProperty', 'toHaveText',
        'toHaveValue', 'toHaveTitle', 'toHaveURL', 'toHaveCount', 'toHaveScreenshot',

        // Negation
        'not',
    ];
    return captureMethods.includes(method);
}

// createPageProxy
export function wrapPlaywrightPage(page: any, world: World): any {
    return new Proxy(page, {
        get(target, prop: string | symbol, receiver) {
            const originalValue = Reflect.get(target, prop, receiver);
            // Handle locator method specially
            if (prop === 'locator') {
                return function(...args: any[]) {
                    const locator = originalValue.apply(target, args);
                    return createLocatorProxy(locator, args[0] as string, world);
                };
            }
            // Handle direct page methods
            if (typeof prop === 'string' && typeof originalValue === 'function' && shouldCaptureMethod(prop)) {
                return function(this: any, ...args: any[]) {
                    const event: any = {
                        type: 'page_action',
                        method: prop,
                        args: serializeArgs(args),
                        start: new Date().getTime(),
                        success: true,
                    };

                    try {
                        const result = originalValue.apply(this, args);

                        if (result && typeof result.then === 'function') {
                            return result.then(
                                (value: any) => {
                                    event.end = new Date().getTime();
                                    event.result = sanitizeResult(value);
                                    attachEvent(world, event);
                                    return value;
                                },
                                (error: Error) => {
                                    event.end = new Date().getTime();
                                    event.success = false;
                                    event.error = {
                                        type: error.name,
                                        message: error.message,
                                        stack: error.stack,
                                    };
                                    attachEvent(world, event);
                                    throw error;
                                },
                            );
                        }
                        else {
                            event.end = new Date().getTime();
                            event.result = sanitizeResult(result);
                            attachEvent(world, event);
                            return result;
                        }
                    }
                    catch (error: any) {
                        event.end = new Date().getTime();
                        event.success = false;
                        event.error = {
                            type: error.name,
                            message: error.message,
                            stack: error.stack,
                        };
                        attachEvent(world, event);
                        throw error;
                    }
                };
            }
            return originalValue;
        },
    });
}

function createLocatorProxy(locator: any, selector: string, world: World): any {
    return new Proxy(locator, {
        get(target: any, prop: string | symbol): any {
            const originalValue = target[prop];

            if (typeof originalValue === 'function' && shouldCaptureMethod(prop as string)) {
                return function(...args: any[]): any {
                    const event: any = {
                        type: 'locator_action',
                        method: prop as string,
                        selector: selector,
                        args: serializeArgs(args),
                        start: new Date().getTime(),
                        success: true,
                    };

                    const result = originalValue.apply(target, args);

                    // Handle promises
                    if (result && typeof result.then === 'function') {
                        return result.then(
                            (value: any) => {
                                event.end = new Date().getTime();
                                event.result = sanitizeResult(value);
                                attachEvent(world, event);
                                return value;
                            },
                            (error: Error) => {
                                event.end = new Date().getTime();
                                event.success = false;
                                event.error = {
                                    type: error.name,
                                    message: error.message,
                                    stack: error.stack,
                                };
                                attachEvent(world, event);
                                throw error;
                            },
                        );
                    }

                    event.end = new Date().getTime();
                    event.result = sanitizeResult(result);
                    attachEvent(world, event);
                    return result;
                };
            }

            return originalValue;
        },
    });
}

async function takeScreenshot(page: any): Promise<string | undefined> {
    try {
        return await page?.screenshot();
    }
    catch (e: any) {
        return undefined;
    }
}
function attachEvent(world: World, event: any): void {
    try {
        const jsonData = JSON.stringify(event);
        world.attach(jsonData, 'application/json;x-origin=cloudbeat');
    }
    catch (error: any) {
        console.warn('Failed to attach Playwright event:', error.message);
    }
}

function serializeArgs(args: any[]): any[] {
    return args.map(arg => {
        return serializeValue(arg);
    });
}

function serializeValue(value: any) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value == null) {
        return value;
    }
    if (typeof value === 'object') {
        try {
            return JSON.parse(JSON.stringify(value));
        }
        catch {
            if (value.constructor && value.constructor.name) {
                return `[${value.constructor.name}]`;
            }
            return '[Object]';
        }
    }
    return '[Unknown]';
}

function sanitizeResult(result: any): any {
    if (result == null) {
        return result;
    }
    if (typeof result === 'string' || typeof result === 'number' || typeof result === 'boolean') {
        return result;
    }
    if (typeof result === 'object' && result.constructor && result.constructor.name) {
        return `[${result.constructor.name}]`;
    }
    return '[Unknown]';
}

function isPlaywrightExpect(expectFunction: any): boolean {
    // Check if this is Playwright's expect function
    // This is a heuristic - you might need to adjust based on your setup
    return expectFunction && expectFunction.name === 'expect' &&
        expectFunction.toString().includes('playwright') ||
        expectFunction.soft !== undefined;
}

export function wrapExpect(originalExpect: any, world: World): any {
    return new Proxy(originalExpect, {
        apply(target: any, thisArg: any, argumentsList: any[]): any {
            const actual = argumentsList[0];
            const event: any = {
                type: 'assertion',
                method: 'expect',
                args: serializeArgs(argumentsList),
                start: new Date().getTime(),
                success: true,
                assertionType: isPlaywrightExpect(target) ? 'playwright_expect' : 'expect',
                actual: serializeValue(actual),
            };

            try {
                const result = target.apply(thisArg, argumentsList);

                // Create a proxy for the expectation object to capture assertion methods
                if (result && typeof result === 'object') {
                    return createExpectationProxy(result, event, world);
                }
                event.end = new Date().getTime();
                attachEvent(world, event);
                return result;
            }
            catch (error) {
                event.end = new Date().getTime();
                event.success = false;
                event.error = {
                    type: (error as Error).name,
                    message: (error as Error).message,
                    stack: (error as Error).stack,
                };
                attachEvent(world, event);
                throw error;
            }
        },
    });
}

function createExpectationProxy(expectation: any, baseEvent: any, world: World): any {
    return new Proxy(expectation, {
        get(target: any, prop: string | symbol): any {
            const originalValue = target[prop];
            if (typeof originalValue === 'function' && shouldCaptureExpectationMethod(prop as string)) {
                return function(...args: any[]): any {
                    const event: any = {
                        ...baseEvent,
                        method: `expect.${prop as string}`,
                        args: serializeArgs(args),
                        start: new Date().getTime(),
                        expected: args.length > 0 ? serializeValue(args[0]) : undefined,
                        success: true,
                    };

                    try {
                        const result = originalValue.apply(target, args);

                        // Handle promises (for Playwright expect)
                        if (result && typeof result.then === 'function') {
                            return result.then(
                                (value: any) => {
                                    event.end = new Date().getTime();
                                    attachEvent(world, event);
                                    return value;
                                },
                                (error: Error) => {
                                    event.end = new Date().getTime();
                                    event.success = false;
                                    event.error = {
                                        type: error.name,
                                        message: error.message,
                                        stack: error.stack,
                                    };
                                    attachEvent(world, event);
                                    throw error;
                                },
                            );
                        }

                        event.end = new Date().getTime();
                        attachEvent(world, event);
                        return result;
                    }
                    catch (error) {
                        event.end = new Date().getTime();
                        event.success = false;
                        event.error = {
                            type: (error as Error).name,
                            message: (error as Error).message,
                            stack: (error as Error).stack,
                        };
                        attachEvent(world, event);
                        throw error;
                    }
                };
            }

            return originalValue;
        },
    });
}
