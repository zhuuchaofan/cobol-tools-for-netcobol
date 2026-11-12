# 发布手册（维护者用）

> 2026-11 时点整理。账号与认证方式变化较快，以各平台官方文档为准：
> [VS Code: Publishing Extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)、
> [Open VSX: Publishing Extensions](https://github.com/eclipse/openvsx/wiki/Publishing-Extensions)

## 0. 公开前检查

- [ ] 用 `F5` 或安装 `.vsix`，在真实 VS Code 里用**自己写的**样例确认高亮、诊断、重新编号、大纲、跳转
- [ ] 仓库里没有任何客户源码、设计书、客户名（`git grep -i` 搜一下项目代号）
- [ ] 确认公司关于个人开源 / 副业成果的规定
- [ ] `package.json` 的 `publisher` 与 Marketplace 上建的 publisher ID 一致（当前为 `zhuuchaofan`）

## 1. 推送到 GitHub

1. 在 GitHub 新建空仓库 **`cobol-tools-for-netcobol`**（Public，不要勾选 README / LICENSE / .gitignore）
2. 在解压后的目录里：

```bash
git remote add origin https://github.com/zhuuchaofan/cobol-tools-for-netcobol.git
git push -u origin main
```

> 本地 commit 的作者是 `zhuuchaofan <zhuuchaofan@users.noreply.github.com>`。
> 想换成自己的邮箱：先 `git config user.email <你的邮箱>`，再
> `git rebase --root --exec "git commit --amend --no-edit --reset-author"`，然后再 push。

3. push 后到 Actions 页确认 **CI** 在 Windows / macOS / Linux 三个平台都通过。

## 2. Visual Studio Marketplace

Azure DevOps 的全局 PAT 在 **2026-12-01 退役**，所以本仓库用 **Trusted Publishing（GitHub OIDC）**，不需要保存任何 token。

1. 打开 <https://marketplace.visualstudio.com/manage>，用 Microsoft 账号登录 → **Create publisher**
   - ID：`zhuuchaofan`（创建后不能改；如果被占用，就换一个，并同时改 `package.json` 的 `publisher` 和 README 里的 `zhuuchaofan.cobol-tools-for-netcobol`）
2. 进入该 publisher → **Trusted Publishing** → **Create policy**
   - Repository owner：`zhuuchaofan`
   - Repository：`cobol-tools-for-netcobol`
   - Workflow file：`release.yml`
   - Environment：留空
3. GitHub 仓库 → Settings → Secrets and variables → Actions → **Variables** → 新建 `PUBLISH_MARKETPLACE` = `true`

> Trusted Publishing 是比较新的功能，我没法在这里实际验证。如果第一次发布在这一步失败：
> 从 GitHub Release 下载 `.vsix`，在上面的 manage 页面 **New extension → Visual Studio Code** 直接上传即可（网页上传不需要 token），之后再排查。

## 3. Open VSX（VSCodium / Cursor / Windsurf 等用）

1. 注册 Eclipse 账号 <https://accounts.eclipse.org/user/register>，**GitHub Username 栏填 `zhuuchaofan`**
2. 用 GitHub 登录 <https://open-vsx.org> → 个人页 **Log in with Eclipse** → **Show Publisher Agreement** → 同意
3. <https://open-vsx.org/user-settings/tokens> → **Generate New Token**（只显示一次，记下来）
4. 在本地执行一次，创建 namespace：

```bash
npx ovsx create-namespace zhuuchaofan -p <token>
```

5. GitHub 仓库 → Settings → Secrets and variables → Actions → **Secrets** → 新建 `OVSX_PAT` = 上面的 token

## 4. 每次发布

```bash
# 1) 改 package.json 的 version，CHANGELOG.md 加 "## x.y.z" 小节
npm test
git commit -am "Release vX.Y.Z"
# 2) 打 tag 并推送
git tag vX.Y.Z
git push origin main --tags
```

`Release` 工作流会依次：

1. 检查 tag 与 `package.json` 版本一致
2. 测试 + 打包
3. 建 GitHub Release（附 `.vsix`，说明取自 CHANGELOG 对应小节）
4. 发布到 Marketplace（`PUBLISH_MARKETPLACE` 为 `true` 时）
5. 发布到 Open VSX（设置了 `OVSX_PAT` 时）

只想先给团队用、还没开通 Marketplace 时，第 4、5 步会自动跳过，同事可以从 Release 下载 `.vsix` 安装。

## 5. 发布后

- Marketplace 上架审核通常几分钟；搜索结果出现可能稍晚
- 在团队项目里加 `.vscode/extensions.json`（见 README「チームで使う」）
- 可以在 Zenn / Qiita 写一篇日文介绍，附上 Marketplace 链接
