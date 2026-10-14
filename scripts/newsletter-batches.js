'use strict';

async function sendChangesInBatches(changes, api) {
  const summary = { sent: 0 };

  for (const change of changes) {
    if (!change.changeFingerprint) {
      throw new Error('待发送更新缺少校验指纹，请重新预览。');
    }

    let afterSubscriberId = 0;
    let recipientCutoff;

    while (true) {
      const result = await api('send-batch', {
        method: 'POST',
        body: JSON.stringify({
          changeFingerprint: change.changeFingerprint,
          afterSubscriberId,
          ...(recipientCutoff ? { recipientCutoff } : {}),
        }),
      });
      summary.sent += Number(result.sent) || 0;
      if (result.complete) break;

      const nextSubscriberId = Number(result.afterSubscriberId);
      if (!Number.isSafeInteger(nextSubscriberId) || nextSubscriberId <= afterSubscriberId) {
        throw new Error('邮件批次没有向前推进，请重新预览后重试。');
      }

      afterSubscriberId = nextSubscriberId;
      recipientCutoff = result.recipientCutoff;
    }
  }

  return summary;
}

module.exports = { sendChangesInBatches };
