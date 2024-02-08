const { fork } = require('child_process');
const Mocha = require('mocha');
const { reporterEvents, testItemStatuses } = require('./constants');
const { IPC_EVENTS } = require('./ipcEvents');
const { startIPCServer } = require('./ipcServer');

const {
  getConfig,
  getLaunchStartObject,
  getSuiteStartObject,
  getSuiteEndObject,
  getTestInfo,
  getHookInfo,
  getTotalSpecs,
} = require('./utils');

const {
  EVENT_RUN_BEGIN,
  EVENT_RUN_END,
  EVENT_TEST_BEGIN,
  EVENT_TEST_END,
  EVENT_SUITE_BEGIN,
  EVENT_SUITE_END,
  EVENT_HOOK_BEGIN,
  EVENT_HOOK_END,
  EVENT_TEST_FAIL,
} = Mocha.Runner.constants;


const { FAILED } = testItemStatuses;

class CypressReporter extends Mocha.reporters.Base {
  constructor(runner, initialConfig) {
    super(runner);
    this.runner = runner;
    const config = getConfig(initialConfig);
  }
}
