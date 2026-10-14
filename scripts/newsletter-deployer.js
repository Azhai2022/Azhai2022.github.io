'use strict';

const { spawn, spawnSync } = require('node:child_process');
const { resolve: resolvePath } = require('node:path');

function newsletterEnvironment() {
  if (process.env.NEWSLETTER_ADMIN_TOKEN || process.platform !== 'darwin') {
    return process.env;
  }

  const result = spawnSync('/usr/bin/security', [
    'find-generic-password',
    '-a',
    process.env.USER || '',
    '-s',
    'azhai-newsletter-admin-token',
    '-w',
  ], { encoding: 'utf8' });
  const token = result.status === 0 ? result.stdout.trim() : '';

  return token ? { ...process.env, NEWSLETTER_ADMIN_TOKEN: token } : process.env;
}

function runNewsletterCli(baseDir, mode, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [resolvePath(baseDir, 'newsletter-cli.js'), mode],
      { cwd: baseDir, env, stdio: 'inherit' },
    );

    child.once('error', reject);
    child.once('close', (code, signal) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`newsletter-cli ${mode} failed${signal ? ` (${signal})` : ` with exit code ${code}`}`));
      }
    });
  });
}

function registerNewsletterDeployer(hexo, dependencies = {}) {
  const gitDeployer = hexo.extend.deployer.get('git');
  if (!gitDeployer) throw new Error('The hexo-deployer-git plugin is required.');

  const getEnvironment = dependencies.newsletterEnvironment || newsletterEnvironment;
  const runCli = dependencies.runNewsletterCli || runNewsletterCli;

  hexo.extend.deployer.register('git-newsletter', function deployWithNewsletter(args) {
    const env = getEnvironment();
    const run = (mode) => runCli(this.base_dir, mode, env);

    return run('preflight')
      .then(() => {
        if (args.g || args.generate) return null;
        return this.call('generate', { force: true });
      })
      .then(() => gitDeployer.call(this, args))
      .then(() => run('deployed'));
  });
}

module.exports = { registerNewsletterDeployer };

if (typeof hexo !== 'undefined') {
  registerNewsletterDeployer(hexo);
}
