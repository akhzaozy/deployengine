import EventEmitter from 'events';

export const queueEvents = new EventEmitter();

export class DeploymentQueue {
  constructor() {
    this.currentBuild = null; // { id, repo, framework, triggerBy, commit, step, totalSteps, stepName, startedAt, estimatedSeconds, timer }
    this.queue = [];          // array of pending jobs: { id, repo, framework, triggerBy, commit, queuedAt, resolve, reject, options }
    this.history = [];        // past completed builds
    this.stageEstimates = {
      'laravel': 45,
      'nextjs': 60,
      'php-native': 18
    };
  }

  getStatus() {
    let activeJob = null;
    if (this.currentBuild) {
      const elapsed = Math.floor((Date.now() - this.currentBuild.startedAt) / 1000);
      const est = this.currentBuild.estimatedSeconds || 45;
      const remaining = Math.max(1, est - elapsed);

      activeJob = {
        id: this.currentBuild.id,
        repo: this.currentBuild.repo,
        framework: this.currentBuild.framework,
        triggerBy: this.currentBuild.triggerBy,
        userId: this.currentBuild.userId || null,
        username: this.currentBuild.username || null,
        commit: this.currentBuild.commit,
        branch: this.currentBuild.branch || 'main',
        step: this.currentBuild.step || 1,
        totalSteps: this.currentBuild.totalSteps || 6,
        stepName: this.currentBuild.stepName || 'Initializing pipeline',
        startedAt: this.currentBuild.startedAt,
        elapsedSeconds: elapsed,
        estimatedSeconds: est,
        remainingSeconds: remaining,
        percentage: Math.min(98, Math.max(5, Math.round((elapsed / est) * 100)))
      };
    }

    const queuedJobs = this.queue.map((job, idx) => {
      let waitSeconds = (activeJob ? activeJob.remainingSeconds : 0);
      for (let i = 0; i < idx; i++) {
        waitSeconds += (this.stageEstimates[this.queue[i].framework] || 40);
      }
      return {
        id: job.id,
        repo: job.repo,
        framework: job.framework,
        triggerBy: job.triggerBy,
        commit: job.commit,
        branch: job.branch || 'main',
        queuePosition: idx + 1,
        estimatedWaitSeconds: waitSeconds,
        queuedAt: job.queuedAt
      };
    });

    return {
      isLocked: !!this.currentBuild,
      currentJob: activeJob,
      queuedJobs,
      queueLength: this.queue.length
    };
  }

  async enqueue(jobDetails, executeFn) {
    const jobId = 'job_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    const est = this.stageEstimates[jobDetails.framework] || 45;

    const job = {
      id: jobId,
      ...jobDetails,
      estimatedSeconds: est,
      queuedAt: Date.now(),
      executeFn
    };

    if (this.currentBuild) {
      // Build is currently running -> enqueue and notify web UI of freeze/wait state
      const promise = new Promise((resolve, reject) => {
        job.resolve = resolve;
        job.reject = reject;
      });
      this.queue.push(job);
      this.broadcastQueueState('job_enqueued', { job, status: this.getStatus() });
      return promise;
    } else {
      // Free slot -> immediately run
      return this.runJob(job);
    }
  }

  async runJob(job) {
    this.currentBuild = {
      ...job,
      startedAt: Date.now(),
      step: 1,
      totalSteps: 6,
      stepName: 'Memulai pipeline...'
    };

    this.broadcastQueueState('job_started', { job: this.getStatus().currentJob });

    try {
      const result = await job.executeFn({
        updateStep: (stepNum, stepName, total = 6) => {
          if (this.currentBuild && this.currentBuild.id === job.id) {
            this.currentBuild.step = stepNum;
            this.currentBuild.stepName = stepName;
            this.currentBuild.totalSteps = total;
            this.broadcastQueueState('job_progress', { job: this.getStatus().currentJob });
          }
        },
        log: (msg) => {
          queueEvents.emit('log', { jobId: job.id, repo: job.repo, msg });
        }
      });

      this.recordHistory(job, 'success');
      this.broadcastQueueState('job_completed', { jobId: job.id, result });
      if (job.resolve) job.resolve(result);
      return result;
    } catch (err) {
      this.recordHistory(job, 'failed', err.message);
      this.broadcastQueueState('job_failed', { jobId: job.id, error: err.message });
      if (job.reject) job.reject(err);
      throw err;
    } finally {
      this.currentBuild = null;
      this.checkNextInQueue();
    }
  }

  checkNextInQueue() {
    if (this.queue.length > 0) {
      const nextJob = this.queue.shift();
      this.broadcastQueueState('job_dequeued', { job: nextJob, status: this.getStatus() });
      this.runJob(nextJob).catch(() => {});
    } else {
      this.broadcastQueueState('queue_empty', { status: this.getStatus() });
    }
  }

  recordHistory(job, status, error = null) {
    const duration = Math.floor((Date.now() - (job.startedAt || Date.now())) / 1000);
    this.history.unshift({
      id: job.id,
      repo: job.repo,
      framework: job.framework,
      triggerBy: job.triggerBy,
      commit: job.commit,
      status,
      error,
      duration,
      finishedAt: new Date().toISOString()
    });
    if (this.history.length > 50) this.history.pop();
  }

  broadcastQueueState(type, data) {
    queueEvents.emit('queue_update', { type, data, timestamp: Date.now(), status: this.getStatus() });
  }
}

export const globalQueue = new DeploymentQueue();
