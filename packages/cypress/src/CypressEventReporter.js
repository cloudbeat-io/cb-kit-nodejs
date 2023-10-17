const {
    EVENT_TEST_BEGIN,
    EVENT_TEST_FAIL,
    EVENT_TEST_PASS,
    EVENT_TEST_PENDING,
    EVENT_SUITE_BEGIN,
    EVENT_SUITE_END,
    EVENT_TEST_END,
    EVENT_HOOK_BEGIN,
    EVENT_HOOK_END
} = Mocha.Runner.constants;

const io = require('socket.io-client');

const getCircularReplacer = () => {
    const seen = new WeakSet();
    return (key, value) => {
        if (key === 'subject' || key === 'next') {
            return;
        }
        if (typeof value === "object" && value !== null) {
            if (seen.has(value)) {
                return;
            }
            seen.add(value);
        }
        return value;
    };
};

module.exports = class CloudBeatEventReporter {
    constructor() {
        // last cucumber step for each test (hashed by test id)
        this.lastCucumberStep = {};
        this.pendingCommands = {};
        this.pendingCucumberStep = {};
        this.socket = io.connect(
            'ws://localhost:3000', 
            {
                transports: ['websocket'],
                origins:'*',
                reconnectionDelay: 0,
                reconnectionDelayMax: 10,
            }
        );
        this.hookToMochaEvents();
        this.hookToCypressEvents();
    }
    hookToMochaEvents() {
        Cypress.mocha
            .getRunner()
            .on(EVENT_SUITE_BEGIN, (suite) => {
                this.socket.emit('mocha:suite:begin', JSON.stringify(suite, getCircularReplacer()));
            })
            .on(EVENT_SUITE_END, (suite) => {
                this.socket.emit('mocha:suite:end', JSON.stringify(suite, getCircularReplacer()));
            })
            .on(EVENT_TEST_BEGIN, (test) => {
                this.socket.emit('mocha:test:begin', JSON.stringify(test, getCircularReplacer()));
            })
            .on(EVENT_TEST_FAIL, (test, err) => {
                this.socket.emit(
                    'mocha:test:fail', 
                    JSON.stringify(test, getCircularReplacer()), 
                    JSON.stringify(err, getCircularReplacer())
                );
            })
            .on(EVENT_TEST_PASS, (test) => {
                this.socket.emit('mocha:test:pass', JSON.stringify(test, getCircularReplacer()));
            })
            .on(EVENT_TEST_PENDING, (test) => {
                this.socket.emit('mocha:test:pending', JSON.stringify(test, getCircularReplacer()));
            })
            .on(EVENT_TEST_END, (test) => {
                this.socket.emit('mocha:test:end', JSON.stringify(test, getCircularReplacer()));
            })
            .on(EVENT_HOOK_BEGIN, (hook) => {
                this.socket.emit('mocha:hook:begin', JSON.stringify(hook, getCircularReplacer()));
            })
            .on(EVENT_HOOK_END, (hook) => {
                this.socket.emit('mocha:hook:end', JSON.stringify(hook, getCircularReplacer()));
            });

    }

    emitEvent(eventType, arg1, arg2) {
        arg1 = arg1 ? JSON.stringify(arg1, getCircularReplacer()) : undefined;
        arg2 = arg2 ? JSON.stringify(arg2, getCircularReplacer()) : undefined;
        try {
            if (arg1 && !arg2) {
                this.socket.emit(eventType, arg1);
            }
            else if (arg1 && arg2) {
                this.socket.emit(eventType, arg1, arg2);
            }
        }
        catch (e) {
            console.log('CloudBeatEventReporter error:', e);
        }
    }

    consoleLog(message, ...args) {
        this.emitEvent('console:log', message, args);
    }

    handleAfterScreenshotEvent($el, props) {
        this.emitEvent('screenshot', props);
    }

    hookToCypressEvents() {
        Cypress.on('log:added', (log) => {
            
            if (log && log.event) {
                return;
            }
            this.emitEvent('log:added', log);
        });

        Cypress.on('log:changed', (log) => {
            if (log && log.event) {
                return;
            }
            
            this.emitEvent('log:changed', log);
        });

        Cypress.Screenshot.defaults({
            onAfterScreenshot: this.handleAfterScreenshotEvent.bind(this),
            screenshotOnRunFailure: true,
            capture: 'fullPage',
        });
    }
};