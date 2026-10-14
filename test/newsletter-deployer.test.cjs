'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { registerNewsletterDeployer } = require('../scripts/newsletter-deployer');

function createDeployer({ runCli } = {}) {
  const order = [];
  let deployer;
  const gitDeployer = async function gitDeploy() {
    order.push('git');
  };
  const hexo = {
    base_dir: '/site',
    extend: {
      deployer: {
        get: (name) => name === 'git' ? gitDeployer : undefined,
        register: (name, fn) => {
          assert.equal(name, 'git-newsletter');
          deployer = fn;
        },
      },
    },
  };

  registerNewsletterDeployer(hexo, {
    newsletterEnvironment: () => ({}),
    runNewsletterCli: runCli || (async (_baseDir, mode) => order.push(mode)),
  });

  const context = {
    base_dir: '/site',
    call: async (name, args) => {
      assert.equal(name, 'generate');
      assert.deepEqual(args, { force: true });
      order.push('generate');
    },
  };

  return { deployer, context, order };
}

test('hexo d preflights, regenerates, deploys, then checks newsletter updates', async () => {
  const { deployer, context, order } = createDeployer();

  await deployer.call(context, {});

  assert.deepEqual(order, ['preflight', 'generate', 'git', 'deployed']);
});

test('newsletter check is skipped when the site deployment fails', async () => {
  const { deployer, context, order } = createDeployer({
    runCli: async (_baseDir, mode) => order.push(mode),
  });
  const failingContext = {
    ...context,
    call: context.call,
  };
  const gitDeployer = async () => {
    order.push('git');
    throw new Error('deploy failed');
  };
  const hexo = {
    base_dir: '/site',
    extend: {
      deployer: {
        get: () => gitDeployer,
        register: (_name, fn) => {
          failingContext.deploy = fn;
        },
      },
    },
  };
  registerNewsletterDeployer(hexo, {
    newsletterEnvironment: () => ({}),
    runNewsletterCli: async (_baseDir, mode) => order.push(mode),
  });

  await assert.rejects(failingContext.deploy.call(failingContext, {}), /deploy failed/);
  assert.deepEqual(order, ['preflight', 'generate', 'git']);
});

test('hexo d -g does not generate a second time', async () => {
  const { deployer, context, order } = createDeployer();

  await deployer.call(context, { g: true });

  assert.deepEqual(order, ['preflight', 'git', 'deployed']);
});
