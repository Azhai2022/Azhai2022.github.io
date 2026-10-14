# 邮件订阅设置

订阅者和文章通知状态存放在现有 Supabase 项目中。订阅确认邮件和文章通知使用 `xllmmm99@163.com` 的独立 SMTP 账号；评论通知继续使用原有邮件配置。通知由个人站部署命令触发，不做定时轮询。

## 首次启用

1. 在 Supabase SQL Editor 执行 `cloudflare-comments/schema.supabase.sql` 中 newsletter 相关的表定义（`newsletter_records` 和 `newsletter_deliveries`）。
2. 在 `cloudflare-comments` 目录部署 Worker：

   ```sh
   npx wrangler secret put NEWSLETTER_ADMIN_TOKEN
   npx wrangler secret put NEWSLETTER_TOKEN_SECRET
   npx wrangler secret put NEWSLETTER_CONFIRM_ANSWER
   npx wrangler secret put NEWSLETTER_SMTP_PASS
   npx wrangler deploy
   ```

   `NEWSLETTER_ADMIN_TOKEN` 和 `NEWSLETTER_TOKEN_SECRET` 使用至少 32 个字符的随机值。`NEWSLETTER_CONFIRM_ANSWER` 输入 `咩咩咩`，作为确认订阅时“希律律”的正确答案。`NEWSLETTER_SMTP_PASS` 输入 `xllmmm99@163.com` 对应的 SMTP 凭据；它与评论邮件使用的 SMTP 凭据分开。不要把 secret 写入仓库或 `wrangler.jsonc`。
3. 在个人站目录使用 `hexo d` 发布网站。部署器会自动预检、重新生成、部署，并在线上更新清单同步后检查邮件：

   ```sh
   # 手动检查 API 时设置本机钥匙串中的令牌
   export NEWSLETTER_ADMIN_TOKEN="$(security find-generic-password -a "$USER" -s azhai-newsletter-admin-token -w)"
   npm run newsletter:check

   # 日常发布；macOS 未设置环境变量时会自动从钥匙串读取令牌
   hexo d
   ```

   其他设备可在当前终端通过 `export NEWSLETTER_ADMIN_TOKEN='你的管理令牌'` 设置后运行 `hexo d`。不要把令牌写入仓库。

`npm run newsletter:check` 会验证本机令牌和线上 Worker 的 newsletter API、数据库是否可用；首次部署时，Worker 尚未初始化文章基线会被视为正常状态。现在运行 `hexo d`、`hexo deploy` 或 `npm run deploy` 都会先预检并强制重新生成网站，再部署，等待线上 `/updates.json` 更新后检查并发送邮件。首次部署会自动登记现有文章作为基线，不会发送旧文章；之后每次成功部署，有新文章或 `update_date` 变化时才会通知已确认订阅的邮箱。

通知邮件会按每批最多 10 位收件人分批发送，发布和手动发送命令会自动处理全部批次；发送中断后重新运行即可，已成功投递的收件人会被跳过。

升级到批次发送时，先在 `cloudflare-comments` 目录运行 `npx wrangler deploy` 更新 Worker，再在个人站目录运行 `hexo d` 发布站点并执行通知。

切换订阅邮件发件邮箱时，在 `cloudflare-comments` 目录设置新邮箱的 SMTP 授权码并部署 Worker：

```sh
npx wrangler secret put NEWSLETTER_SMTP_PASS
npx wrangler deploy
```

按提示输入 `xllmmm99@163.com` 对应的 SMTP 凭据。此变更只涉及 Worker，无需重新发布个人站；确认邮件和文章通知使用新邮箱，评论通知仍使用原配置。

## 手动检查与发送

可以随时查看待通知列表：

```sh
npm run newsletter:preview
```

部署命令是日常自动发送入口。如需手动立即发送，可运行：

```sh
npm run newsletter:send
```

命令会再次展示文章清单，并要求输入 `yes` 才会发送。取消或关闭命令都不会发信。非交互环境不会发送，除非明确添加 `--yes`。

`update_date` 变化会列为“章节更新”；新出现的文章会列为“新文章”。每次章节更新都要把 `update_date` 改成新的值；同一天更新多次时请填不同的具体时间，只改正文不会触发通知。自动任务或手动发送成功后会更新文章状态，已处理的更新不会在下一轮重复发送。每位收件人的成功投递也会单独记录，重试时会跳过已成功的收件人。

提交邮箱后会收到确认邮件；点击邮件中的链接，回答“希律律”并输入“咩咩咩”后，订阅才会启用。答案只保存在 Cloudflare Worker Secret 中，不写入网站代码。更新邮件含退订链接。管理命令只在本地读取 `NEWSLETTER_ADMIN_TOKEN` 环境变量。
