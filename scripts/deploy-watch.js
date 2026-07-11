/**
 * Deploy watcher — poll GitHub and auto-deploy on new commits.
 *
 * Run on the production machine under pm2, next to the meetube app:
 *   pm2 start scripts/deploy-watch.js --name meetube-deploy
 *
 * Loop: git fetch → if origin/master is ahead → pull → install (only if
 * lockfile changed) → build → pm2 restart meetube. Build failure skips the
 * restart so the old version keeps serving.
 */

import { execSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BRANCH = process.env.DEPLOY_BRANCH || 'master'
const APP_NAME = process.env.DEPLOY_APP || 'meetube'
const POLL_MS = Number(process.env.DEPLOY_POLL_MS) || 2 * 60 * 1000

function run(cmd) {
  return execSync(cmd, { cwd: ROOT, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`)
}

function deploy(localHead, remoteHead) {
  log(`New version detected: ${localHead.slice(0, 7)} → ${remoteHead.slice(0, 7)}`)

  const lockBefore = run('git rev-parse HEAD:package-lock.json')
  run(`git pull --ff-only origin ${BRANCH}`)
  const lockAfter = run('git rev-parse HEAD:package-lock.json')

  if (lockBefore !== lockAfter) {
    log('Lockfile changed, running npm ci...')
    run('npm ci')
  }

  log('Building client...')
  run('npm run build')

  log(`Restarting ${APP_NAME}...`)
  run(`pm2 restart ${APP_NAME}`)
  log(`Deployed ${remoteHead.slice(0, 7)} ✓`)
}

function tick() {
  try {
    run(`git fetch origin ${BRANCH}`)
    const localHead = run('git rev-parse HEAD')
    const remoteHead = run(`git rev-parse origin/${BRANCH}`)

    if (localHead !== remoteHead) {
      deploy(localHead, remoteHead)
    }
  } catch (error) {
    log(`Deploy failed, keeping current version: ${error.message}`)
  }
  setTimeout(tick, POLL_MS)
}

log(`Watching origin/${BRANCH} every ${POLL_MS / 1000}s (root: ${ROOT})`)
tick()
