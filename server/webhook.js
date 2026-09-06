import crypto from 'crypto';
import { globalQueue } from './queue.js';
import { DeployRunner } from './deploy-runner.js';

export class WebhookHandler {
  static verifySignature(secret, headerSignature, rawBody) {
    if (!secret) return true; // If no secret configured, pass
    if (!headerSignature) return false;

    const hmac = crypto.createHmac('sha256', secret);
    const digest = 'sha256=' + hmac.update(rawBody).digest('hex');

    try {
      return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(headerSignature));
    } catch {
      return false;
    }
  }

  static async handleGitHubPush(payload, projectsStore) {
    const repoName = payload.repository?.name;
    const ref = payload.ref || 'refs/heads/main';
    const branch = ref.replace('refs/heads/', '');
    const commitMsg = payload.head_commit?.message || 'New commit via GitHub Push';
    const author = payload.pusher?.name || payload.sender?.login || 'github-actions';
    const commitHash = (payload.head_commit?.id || 'unknown').slice(0, 7);

    // Find registered project
    const project = projectsStore.find(p => p.repo.toLowerCase() === repoName.toLowerCase());

    if (!project) {
      return {
        matched: false,
        message: `Repository '${repoName}' tidak terdaftar di sistem AutoDeploy.`
      };
    }

    // Check if target branch matches
    if (project.branch && project.branch !== branch) {
      return {
        matched: false,
        message: `Branch '${branch}' diabaikan (hanya memantau branch '${project.branch}').`
      };
    }

    // Enqueue build job with freeze/queue notification
    const jobPromise = globalQueue.enqueue({
      repo: project.repo,
      framework: project.framework,
      triggerBy: `GitHub Webhook (@${author})`,
      commit: `${commitHash}: ${commitMsg}`,
      branch
    }, async (context) => {
      return DeployRunner.runPipeline(project, context);
    });

    return {
      matched: true,
      queued: true,
      repo: project.repo,
      branch,
      commitHash,
      queueStatus: globalQueue.getStatus()
    };
  }
}
