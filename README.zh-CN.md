# WHOOP → Google Calendar

把 WHOOP 的睡眠、小睡和运动自动写入你已有的 Google 日历。运行在你自己的 Google Apps Script 中，不需要 IFTTT 付费订阅或单独服务器，需要自己的 WHOOP 账号和 Developer 应用。

支持 emoji 标题、真实开始／结束时间、睡眠阶段与效率、运动心率与 Strain、每小时同步、去重和已有事件更新。

## 安装

1. 新建 Google Apps Script 项目，把 `WhoopCalendar.gs`、`Settings.gs` 分别复制进去。
2. 在项目设置中显示 `appsscript.json`，用仓库提供的版本替换。它包含 Google OAuth2 库的固定版本及所需权限。无需部署网页应用。
3. 从 Google 日历设置 → 目标日历 →「集成日历」复制 Calendar ID，填入 `Settings.gs` 的 `calendarId`。脚本只使用已有日历。
4. 设置 `displayTimeZone`，例如 Nashville 使用 `America/Chicago`。Google 日历「常规 → 时区」也要选中部时间。脚本中的时区用于说明文字，日历自己的时区控制页面显示；真实起止时间始终保留，夏令时由时区规则处理。
5. 在 WHOOP Developer Dashboard 创建自己的应用，只申请 `read:sleep`、`read:workout`。注册回调地址：`https://script.google.com/macros/d/你的SCRIPT_ID/usercallback`。SCRIPT_ID 在 Apps Script 项目设置中。应用联系信息与隐私说明须使用你自己的内容；`PRIVACY.md` 可作为模板。
6. 在 Apps Script 的「脚本属性」中保存 `WHOOP_CLIENT_ID` 和 `WHOOP_CLIENT_SECRET`，不要写进源文件或提交 Git。
7. 依次运行 `showSetup`、`authorizeWhoop`，查看并完成 Google 与 WHOOP 授权。授权链接仅供本人使用，不要分享。个人脚本可能显示 Google 未验证应用提示，由你自己检查权限并决定是否继续。
8. 运行 `enableSync`：默认导入最近 30 天，然后创建每小时任务。再次运行 `syncWhoop`，未变更的数据应该新增 0 条。

可以修改 `Settings.gs` 中的标题、导入范围、回看范围和全量复核间隔。`disableSync` 停止自动任务，已有事件和授权仍保留。换目标日历须使用[独立迁移工具](extras/README.md)。

## 使用边界

睡眠时间块包含清醒时间；实际睡眠和各阶段总时长写在说明里。没有数据的指标会省略。暂不同步 WHOOP 删除操作，也不读取恢复分数或 HRV。手动编辑的标题和说明会被同步覆盖，手动删除的事件可能重新出现。

保留说明中的 `WHOOP-SOURCE` 标记，以便中断后去重。同步受 Google／WHOOP 配额影响，大量历史导入可分多次完成。注意目标日历的共享权限：能看详情的人也能看到健康数据。每位使用者都需要自行安装和授权，本仓库没有托管你的凭据或数据。

[英文完整安装说明、限制和测试方式](README.md)。MIT 开源，非 WHOOP 或 Google 官方项目。
