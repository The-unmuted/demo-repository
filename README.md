![Auto Assign](https://github.com/The-unmuted/demo-repository/actions/workflows/auto-assign.yml/badge.svg)

![Proof HTML](https://github.com/The-unmuted/demo-repository/actions/workflows/proof-html.yml/badge.svg)

# The Unmuted | 非默

> *Make truth indelible; ensure no survivor stands alone.*  
> *让真相不被抹去，让求助不再孤身一人。*

**The Unmuted** is a bilingual, mobile-first demo repository for a public safety collaboration product focused on anonymous help reporting, mutual support, map-based alerts, evidence preservation, and DAO-based survivor aid. It combines privacy-preserving identity, Phantom wallet support, email OTP signup through Privy, local encryption, demo on-chain proof, live-location SOS, supporter matching, and an alert map that visualizes reported help requests with purple/yellow color-graded risk levels and report counts.

**非默** 是一个双语、移动端优先的公共安全协作产品 Demo 仓库，面向匿名求助上报、互助支援、地图预警、证据保存与 DAO 救助治理。当前版本整合了隐私身份、Phantom 钱包、Privy 邮箱 OTP 注册、本地加密、演示链上存证、实时位置 SOS、支援者匹配，以及根据求助上报数量生成紫黄颜色分级和数量提示的预警地图。

---

## Current Demo | 当前版本

- **Bilingual UI:** English and Chinese switch with one button; the app shows one language at a time.
- **First-time signup:** Users sign up once, then stay signed in locally. Signup supports Phantom wallet signature or email contact/Privy OTP.
- **Soft safety design:** Gentle purple interface, mark-only logo, and the banner “secure, record, protect, speak.”
- **Main flow:** The first page centers emergency help and community help, with evidence capture available after a report.
- **Bottom tabs:** Help, Map, Support, and DAO.
- **Map page:** The Map page displays the warning map, color legend, report counts, user location, and map-based alert zones.
- **Support page:** The Support page provides the supporter workflow for nearby anonymous help requests.
- **DAO page:** The DAO page supports aid proposals, voting, professional SBT-style credentials, and a MagicBlock Private DAO Room demo layer.
- **Solana Devnet program:** A minimal The Unmuted privacy-checkpoint program is deployed on Solana Devnet for the hackathon demo.

- **双语界面：** 中英文通过按钮切换，同一时间只展示一种语言。
- **首次注册：** 用户首次进入需要注册，之后在本地保持登录状态。支持 Phantom 钱包签名，也支持邮箱联系 / Privy OTP。
- **柔和安全视觉：** 以紫色系为主，使用图形 Logo，并保留 “secure, record, protect, speak / 安全，记录，守护，发声” 的品牌语义。
- **主流程：** 首页突出紧急求助与社区求助，完成上报后可进入存证流程。
- **底部导航：** Help、Map、Support、DAO。
- **地图页面：** Map 页面展示预警地图、颜色图例、上报数量、用户定位和地图预警区域。
- **支援页面：** Support 页面提供面向附近匿名求助的支援者流程。
- **DAO 页面：** DAO 页面支持救助提案、投票、专业人士 SBT 风格认证，以及 MagicBlock 私密 DAO 审核室演示层。
- **Solana Devnet 程序：** 为黑客松 Demo 部署了一个最小化的 The Unmuted 隐私检查点程序。

---

## Core Features | 核心功能

### 1. Help Reporting | 求助上报

- One primary SOS flow for immediate emergency reporting.
- Community Help supports non-emergency requests such as emotional support, accompaniment, and practical information.
- Live location can be attached to emergency alerts for supporter response.
- Non-emergency support uses approximate location to reduce privacy exposure.
- After reporting, users can add evidence when they are safe.

- 核心 SOS 流程用于紧急求助上报。
- 社区求助支持非紧急场景，例如情绪支持、陪同和实用信息协助。
- 紧急上报可附带实时位置，方便支援者响应。
- 非紧急支援使用大致位置，降低隐私暴露。
- 完成上报后，用户可以在安全时补充证据。

### 2. Map Alerts | 地图预警

- The Map page directly displays warning zones based on reported help requests.
- Reported help requests are grouped into map zones and visualized with color-graded alert blocks.
- Purple and yellow are used as the main contrast colors to match the product UI while keeping clear light/dark separation.
- Each alert zone shows a report count, making the level of reported need visible at a glance.
- The map supports drag, zoom in/out, user location, and map-local scrolling.
- Demo alert records help reviewers understand how report density becomes visible on the map.

- Map 页面直接展示基于求助上报生成的预警区域。
- 用户上报的求助会聚合为地图区域，并通过颜色分级提示预警强度。
- 颜色以紫色和黄色作为主要对比，既贴合产品 UI，也保留清晰的明暗区分。
- 每个预警区域展示上报数量，让求助密度一眼可见。
- 地图支持拖动、缩放、用户定位和地图内部滚动。
- 页面内置演示预警记录，方便评审理解求助密度如何在地图上可视化。

### 3. Support | 互助支援

- The Support page focuses on supporter mode.
- Community members can opt in as supporters and watch nearby anonymous requests.
- SOS support alerts and community help requests are shown separately inside the support workflow.
- Supporters can open encrypted P2P-style chat rooms for follow-up.
- Built-in demo examples help reviewers understand the support flow quickly.

- Support 页面聚焦支援者模式。
- 社区成员可选择成为支援者，查看附近匿名求助。
- SOS 紧急支援与社区非紧急求助在支援流程中分开展示。
- 支援者可进入端到端加密风格的匿名聊天通道继续沟通。
- 页面内置演示案例，方便评审快速理解支援流程。

### 4. Evidence Preservation | 安全存证

- Evidence capture is available after a help report.
- Photo, video, and audio evidence can be encrypted locally with AES-256-GCM.
- Encrypted evidence is stored in a demo Arweave-style vault.
- Hashes are anchored through a Solana Memo-style proof flow, with simulation fallback for demo reliability.
- Users can download a local key bundle for later decryption.

- 存证功能可在求助上报后使用。
- 图片、视频和音频证据可在本地通过 AES-256-GCM 加密。
- 加密证据进入演示版 Arweave 风格存证库。
- 哈希通过 Solana Memo 风格流程进行时间证明，Demo 中支持模拟回退。
- 用户可下载本地密钥包，方便后续解密。

### 5. DAO | DAO 治理与救助

- Survivors can create aid proposals for legal, mental health, or community support.
- DAO voting is tied to anonymous identity, reducing repeated random identities.
- Professionals can claim SBT-style credentials for expert endorsements.
- The professional SBT flow includes a front-end-only certification upload page for demo review.
- The DAO page includes a MagicBlock Private DAO Room demo card for private aid and professional credential review.
- A minimal The Unmuted Solana Devnet program is deployed for privacy-safe DAO/evidence checkpoints. It accepts checkpoint instruction types and logs that only hashes/checkpoints should be submitted on-chain.

- 受助者可发起法律、心理或社区支持提案。
- DAO 投票绑定匿名身份，降低重复随机身份带来的滥用。
- 专业人士可认领 SBT 风格认证，提供专家背书。
- 专业 SBT 认领包含前端演示版认证材料上传页面。
- DAO 页面包含 MagicBlock 私密 DAO 审核室演示卡片，用于私密救助与专业认证审核展示。
- 已部署最小化 The Unmuted Solana Devnet 程序，用于隐私安全的 DAO / 存证检查点。程序接收检查点指令类型，并强调链上只应提交哈希或检查点。

### 6. Solana Devnet Deployment | Solana Devnet 部署

- **Program ID:** `BAnZZzYmRkonjWMS1Zhn8bbJrX8nNT9RMvhpKdeV722k`
- **Network:** Solana Devnet
- **Explorer:** https://explorer.solana.com/address/BAnZZzYmRkonjWMS1Zhn8bbJrX8nNT9RMvhpKdeV722k?cluster=devnet
- **Deploy transaction:** `3gNG55ZqoMVW6P4CzADsS8frEJuB81qXcn6qHUGsZmAMtSVNvVX4hB3qEepynN12bTUmbrqkqPieg9CYFAtZEDrT`
- **Upgrade authority:** `5sQsDXrTzfrhNx34Q2NuLjYtsSQvrGb79LBU8z8uEsgz`
- **Program source:** `programs/the_unmuted_program/src/lib.rs`
- **What it does now:** The program is intentionally small for demo safety. It receives privacy-safe checkpoint instructions for SOS evidence, DAO private review, and professional SBT review, then logs that only hashes/checkpoints should go on-chain.
- **Production path:** Replace log-only checkpoints with structured PDA accounts, hashed evidence commitments, DAO decision state, SBT issuance status, and MagicBlock settlement commitments.

- **程序 ID：** `BAnZZzYmRkonjWMS1Zhn8bbJrX8nNT9RMvhpKdeV722k`
- **网络：** Solana Devnet
- **浏览器：** https://explorer.solana.com/address/BAnZZzYmRkonjWMS1Zhn8bbJrX8nNT9RMvhpKdeV722k?cluster=devnet
- **部署交易：** `3gNG55ZqoMVW6P4CzADsS8frEJuB81qXcn6qHUGsZmAMtSVNvVX4hB3qEepynN12bTUmbrqkqPieg9CYFAtZEDrT`
- **升级权限：** `5sQsDXrTzfrhNx34Q2NuLjYtsSQvrGb79LBU8z8uEsgz`
- **程序源码：** `programs/the_unmuted_program/src/lib.rs`
- **当前功能：** Demo 版本刻意保持最小化。它接收 SOS 存证、DAO 私密审核、专业 SBT 审核等隐私安全检查点指令，并在日志中强调链上只提交哈希 / 检查点。
- **正式路径：** 后续可替换为结构化 PDA 账户、证据哈希承诺、DAO 决策状态、SBT 签发状态，以及 MagicBlock 结算承诺。

### 7. MagicBlock Privacy Demo | MagicBlock 隐私演示

- **Private DAO Room:** The DAO page presents a front-end simulation of a MagicBlock Private DAO Room.
- **Delegated review state:** Sensitive proposal details and professional certification packets can be represented as private review state.
- **TEE-gated reviewer access:** Verified SBT reviewers can be modeled as permissioned reviewers for private materials.
- **Public settlement result:** The public DAO only needs the approved result, aid decision, or SBT claim outcome.
- **Demo scope:** This repository demonstrates the UX and architecture. It does not call a live MagicBlock rollup or TEE service.

- **私密 DAO 审核室：** DAO 页面展示 MagicBlock Private DAO Room 风格的前端模拟。
- **委托审核状态：** 敏感提案细节与专业认证材料可被表示为私密审核状态。
- **TEE 限权审核访问：** 已验证的 SBT 审核者可被建模为私密材料的限权审核者。
- **公开结算结果：** 公开 DAO 只需要接收审核通过后的救助决策、投票结果或 SBT 认领结果。
- **Demo 范围：** 当前仓库展示 UX 与架构，不调用真实 MagicBlock rollup 或 TEE 服务。

---

## Tech Stack | 技术栈

| Layer | Technology |
| --- | --- |
| Frontend | React 18, TypeScript, Vite |
| Styling | Tailwind CSS, shadcn/ui components, lucide-react |
| Auth | Privy email OTP, Phantom wallet signature, local fallback |
| Chain | Solana Devnet custom program, Phantom, Solana Memo-style anchoring |
| Storage | Demo Arweave-style vault, IndexedDB, localStorage |
| Encryption | Web Crypto API, AES-256-GCM |
| P2P Demo | Gun.js for support/chat/DAO demo broadcasts |
| Map Alerts | OpenStreetMap tiles, local alert records, color-graded zones |
| Privacy Compute Demo | MagicBlock Private Ephemeral Rollup-style DAO review simulation |

---

## Getting Started | 运行

https://the-unmuted.vercel.app/

---

## Environment | 环境变量

Create `.env.local` when using real Privy email OTP:

```bash
VITE_PRIVY_APP_ID=your_privy_app_id
VITE_SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
```

`VITE_PRIVY_APP_ID` enables real Privy email OTP signup. Without it, the app still runs for demos with Phantom signup and limited email-contact identity.

`VITE_SOLANA_RPC_URL` can be used for future production RPC configuration. The current evidence anchoring demo can fall back to simulation so reviewers can test the flow without funds.

---

## Demo Notes | Demo 说明

- This repository is the demo codebase for The Unmuted final product prototype.
- Some Web3 operations intentionally have simulation fallbacks so the demo works without paid infrastructure or wallet funding.
- The app uses Help, Map, Support, and DAO as the main bottom navigation tabs.
- The Map page shows purple/yellow alert grading and report counts for map-based risk awareness.
- The Support page provides the supporter workflow for nearby anonymous requests.
- Certification upload in the DAO tab is front-end-only for demo review.
- The MagicBlock Private DAO Room is a front-end architecture simulation for private review flows.
- The custom Solana Devnet program is live, but the current frontend still uses Memo anchoring/simulation for user-triggered evidence flows. The next integration step is wiring frontend checkpoint instructions directly into the deployed program.
- Private evidence keys are user-held. Losing the downloaded key bundle can make encrypted evidence unrecoverable in a production design.

- 本仓库是 The Unmuted 最终产品原型的 Demo 代码库。
- 部分 Web3 操作为确保演示稳定，保留模拟回退。
- 应用底部主导航为 Help、Map、Support、DAO。
- Map 页面通过紫黄颜色分级和上报数量展示地图预警。
- Support 页面提供附近匿名求助的支援者流程。
- DAO 专业认证上传目前为前端 Demo。
- MagicBlock 私密 DAO 审核室是用于私密审核流程的前端架构模拟。
- 自定义 Solana Devnet 程序已上线，但当前前端的用户触发式存证流程仍使用 Memo anchoring / 模拟回退。下一步是把前端检查点指令直接接入已部署程序。
- 私密证据密钥由用户保存；正式版本中若遗失密钥，可能无法恢复加密证据。

---

## Team Members | 团队成员

- Gu Shi: https://github.com/hesta1218-collab
- Wendy Wu: https://github.com/DancinWendy
- Liz Wu: https://github.com/touhouzigei-crypto
- Katie Lin: https://github.com/katielin0207-dev
