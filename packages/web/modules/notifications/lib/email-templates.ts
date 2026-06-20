const baseStyles = `
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  line-height: 1.6;
  color: #1a1a1a;
  max-width: 600px;
  margin: 0 auto;
`;

const headerStyles = `
  background: #0f0f0f;
  padding: 32px 24px;
  text-align: center;
  border-radius: 12px 12px 0 0;
`;

const bodyStyles = `
  background: #ffffff;
  padding: 32px 24px;
  border: 1px solid #e5e5e5;
  border-top: none;
  border-radius: 0 0 12px 12px;
`;

const buttonStyles = `
  display: inline-block;
  background: #0f0f0f;
  color: #ffffff;
  text-decoration: none;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 14px;
`;

const badgeStyles = (color: string) => `
  display: inline-block;
  background: ${color}15;
  color: ${color};
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
`;

function wrap(title: string, body: string) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="${baseStyles}">
  <div style="${headerStyles}">
    <h1 style="color: #ffffff; margin: 0; font-size: 24px;">🐴 Code Horse</h1>
  </div>
  <div style="${bodyStyles}">
    <h2 style="margin: 0 0 20px; font-size: 20px;">${title}</h2>
    ${body}
    <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;">
    <p style="color: #888; font-size: 12px; margin: 0;">
      Code Horse — AI-powered code reviews. <a href="https://codehorse.app/dashboard/settings" style="color: #888;">Manage email preferences</a>
    </p>
  </div>
</body>
</html>`;
}

export function reviewCompletedEmail(
  reviewTitle: string,
  prNumber: number,
  repoName: string,
  reviewUrl: string
) {
  return wrap(
    "Review Complete",
    `
    <p>Your AI code review for <strong>${repoName}</strong> is ready.</p>
    <div style="background: #f9f9f9; padding: 16px; border-radius: 8px; margin: 16px 0;">
      <p style="margin: 0; font-size: 12px; color: #888; text-transform: uppercase; font-weight: 600;">Pull Request</p>
      <p style="margin: 4px 0 0; font-weight: 600;">#${prNumber} ${reviewTitle}</p>
    </div>
    <a href="${reviewUrl}" style="${buttonStyles}">View Review</a>
    `
  );
}

export function reviewFailedEmail(
  reviewTitle: string,
  prNumber: number,
  repoName: string,
  errorMessage: string
) {
  return wrap(
    "Review Failed",
    `
    <p>The AI code review for <strong>${repoName}</strong> encountered an error.</p>
    <div style="background: #f9f9f9; padding: 16px; border-radius: 8px; margin: 16px 0;">
      <p style="margin: 0; font-size: 12px; color: #888; text-transform: uppercase; font-weight: 600;">Pull Request</p>
      <p style="margin: 4px 0 0; font-weight: 600;">#${prNumber} ${reviewTitle}</p>
    </div>
    <div style="background: #fef2f2; border: 1px solid #fecaca; padding: 16px; border-radius: 8px; margin: 16px 0;">
      <p style="margin: 0; font-size: 12px; color: #dc2626; text-transform: uppercase; font-weight: 600;">Error</p>
      <p style="margin: 4px 0 0; color: #991b1b; font-size: 14px;">${errorMessage}</p>
    </div>
    <p style="color: #888; font-size: 14px;">If this keeps happening, please reach out to support.</p>
    `
  );
}

export function usageLimitWarningEmail(
  usageType: string,
  current: number,
  limit: number
) {
  const percentage = Math.round((current / limit) * 100);
  const friendlyType = usageType === "reviews" ? "code reviews" : usageType;

  return wrap(
    "Usage Limit Warning",
    `
    <p>You've used <strong>${current}</strong> of your <strong>${limit}</strong> monthly ${friendlyType} (${percentage}%).</p>
    <div style="background: #f9f9f9; padding: 16px; border-radius: 8px; margin: 16px 0;">
      <div style="background: #e5e5e5; border-radius: 4px; height: 8px; overflow: hidden;">
        <div style="background: ${percentage >= 90 ? "#dc2626" : "#f59e0b"}; width: ${percentage}%; height: 100%; border-radius: 4px;"></div>
      </div>
      <p style="margin: 12px 0 0; font-size: 14px; color: #666;">
        ${percentage >= 90
          ? "You're almost at your limit. Upgrade to Pro for unlimited reviews."
          : "Consider upgrading to Pro for unlimited reviews."}
      </p>
    </div>
    <a href="https://codehorse.app/dashboard/subscriptions" style="${buttonStyles}">Upgrade to Pro</a>
    `
  );
}

export function subscriptionChangedEmail(newTier: string, status: string) {
  const tierLabel = newTier === "PRO" ? "Pro" : "Free";
  const isUpgrade = newTier === "PRO";

  return wrap(
    "Subscription Updated",
    `
    <p>Your subscription has been updated.</p>
    <div style="background: #f9f9f9; padding: 16px; border-radius: 8px; margin: 16px 0;">
      <table style="width: 100%; font-size: 14px;">
        <tr>
          <td style="padding: 4px 0; color: #888;">Plan</td>
          <td style="padding: 4px 0; text-align: right; font-weight: 600;">${tierLabel}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #888;">Status</td>
          <td style="padding: 4px 0; text-align: right;">
            <span style="${badgeStyles(status === "ACTIVE" ? "#16a34a" : status === "CANCELLED" ? "#dc2626" : "#888")}">${status}</span>
          </td>
        </tr>
      </table>
    </div>
    ${isUpgrade
      ? "<p>Thanks for upgrading! You now have unlimited code reviews and priority processing.</p>"
      : status === "CANCELLED"
        ? "<p>Your subscription has been cancelled. You'll retain Pro access until the end of your billing period.</p>"
        : "<p>Your plan has been updated.</p>"}
    <a href="https://codehorse.app/dashboard/subscriptions" style="${buttonStyles}">Manage Subscription</a>
    `
  );
}

export function commentReplyEmail(
  prTitle: string,
  prNumber: number,
  repoName: string,
  replySnippet: string,
  prUrl: string
) {
  return wrap(
    "Code Horse Replied",
    `
    <p>Code Horse replied to a comment on your pull request.</p>
    <div style="background: #f9f9f9; padding: 16px; border-radius: 8px; margin: 16px 0;">
      <p style="margin: 0; font-size: 12px; color: #888; text-transform: uppercase; font-weight: 600;">Pull Request</p>
      <p style="margin: 4px 0 0; font-weight: 600;">#${prNumber} ${prTitle}</p>
      <p style="margin: 8px 0 0; font-size: 12px; color: #888;">${repoName}</p>
    </div>
    <div style="background: #f0f9ff; border: 1px solid #bae6fd; padding: 16px; border-radius: 8px; margin: 16px 0;">
      <p style="margin: 0; font-size: 12px; color: #0369a1; text-transform: uppercase; font-weight: 600;">Reply Preview</p>
      <p style="margin: 8px 0 0; font-size: 14px; color: #334155;">${replySnippet}</p>
    </div>
    <a href="${prUrl}" style="${buttonStyles}">View on GitHub</a>
    `
  );
}
