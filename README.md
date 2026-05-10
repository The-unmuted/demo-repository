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
- **Main flow:** The first page centers emergency help and community help. Evidence preservation remains available after a report instead of being a primary bottom tab.
- **Bottom tabs:** Help, Support, Alert, and DAO.
- **Support page:** The mutual-support page keeps the supporter workflow only; the previous identity and warning sections were removed.
- **Alert page:** The previous standalone Map / Evidence bottom entry is now Alert. The Alert page directly displays the warning map, color legend, and report counts.
- **MagicBlock demo layer:** The DAO tab includes a front-end simulation of a MagicBlock Private Ephemeral Rollup review room for private aid and professional credential review.

- **双语界面：** 中英文通过按钮切换，同一时间只展示一种语言。
- **首次注册：** 用户首次进入需要注册，之后在本地保持登录状态。支持 Phantom 钱包签名，也支持邮箱联系 / Privy OTP。
- **柔和安全视觉：** 以紫色系为主，使用图形 Logo，并保留 “secure, record, protect, speak / 安全，记录，守护，发声” 的品牌语义。
- **主流程：** 首页突出紧急求助与社区求助。存证功能仍然保留，但作为求助后的流程，不再作为底部主导航页面。
- **底部导航：** Help、Support、Alert、DAO。
- **互助页面：** 互助页面只保留支援流程，原本的身份和预警区域已移除。
- **预警页面：** 原本独立的 Map / Evidence 底部入口已调整为 Alert。预警页面直接展示地图、颜色图例和上报数量。
- **MagicBlock 演示层：** DAO 页面加入 MagicBlock Private Ephemeral Rollup 风格的前端模拟，用于私密救助与专业认证审核。

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

### 2. Support | 互助支援

- The Support page focuses on supporter mode only.
- Community members can opt in as supporters and watch nearby anonymous requests.
- SOS support alerts and community help requests are shown separately inside the support workflow.
- Supporters can open encrypted P2P-style chat rooms for follow-up.
- Built-in demo examples help reviewers understand the support flow quickly.

- 互助页面现在只保留支援功能。
- 社区成员可选择成为支援者，查看附近匿名求助。
- SOS 紧急支援与社区非紧急求助在支援流程中分开展示。
- 支援者可进入端到端加密风格的匿名聊天通道继续沟通。
- 页面内置演示案例，方便评审快速理解支援流程。

### 3. Alert Map | 预警地图

- The previous standalone Map / Evidence bottom entry has been replaced with Alert.
- The Alert page directly displays the warning map instead of keeping the map as a separate bottom tab.
- Reported help requests are grouped into map zones and visualized with color-graded alert blocks.
- Purple and yellow are used as the main contrast colors to match the product UI while keeping clear light/dark separation.
- Each alert zone shows a report count, making the level of reported need visible at a glance.
- The map supports drag, zoom in/out, user location, and map-local scrolling.

- 原本独立的 Map / Evidence 底部入口已改为预警。
- 预警页面直接展示地图，不再保留独立的底部地图页。
- 用户上报的求助会聚合为地图区域，并通过颜色分级提示预警强度。
- 颜色以紫色和黄色作为主要对比，既贴合产品 UI，也保留清晰的明暗区分。
- 每个预警区域展示上报数量，让求助密度一眼可见。
- 地图支持拖动、缩放、用户定位和地图内部滚动。

### 4. Evidence Preservation | 安全存证

- Evidence capture remains available after a help report instead of being a primary bottom tab.
- Photo, video, and audio evidence can be encrypted locally with AES-256-GCM.
- Encrypted evidence is stored in a demo Arweave-style vault.
- Hashes are anchored through a Solana Memo-style proof flow, with simulation fallback for demo reliability.
- Users can download a local key bundle for later decryption.

- 存证功能仍然保留，但作为求助上报后的流程，而不是底部主导航页面。
- 图片、视频和音频证据可在本地通过 AES-256-GCM 加密。
- 加密证据进入演示版 Arweave 风格存证库。
- 哈希通过 Solana Memo 风格流程进行时间证明，Demo 中支持模拟回退。
- 用户可下载本地密钥包，方便后续解密。

### 5. DAO | DAO 治理与救助

- Survivors can create aid proposals for legal, mental health, or community support.
- DAO voting is tied to anonymous identity, reducing repeated random identities.
- Professionals can claim SBT-style credentials for expert endorsements.
- The professional SBT flow includes a front-end-only certification upload page for demo review.
- The DAO tab now includes a MagicBlock Private DAO Room demo card showing how sensitive proposal details and professional certification packets could be delegated to a Private Ephemeral Rollup-style review room before final Solana settlement.

- 受助者可发起法律、心理或社区支持提案。
- DAO 投票绑定匿名身份，降低重复随机身份带来的滥用。
- 专业人士可认领 SBT 风格认证，提供专家背书。
- 专业 SBT 认领包含前端演示版认证材料上传页面。
- DAO 页面现在包含 MagicBlock 私密 DAO 审核室演示卡片，展示敏感提案细节与专业认证包如何先委托到 Private Ephemeral Rollup 风格的审核室，再把最终结果结算回 Solana。

### 6. MagicBlock Privacy Demo | MagicBlock 隐私演示

- **What is shown now:** A front-end MagicBlock Private DAO Room in the DAO tab. It explains a three-step flow: delegate private review state, allow TEE-gated SBT reviewer access, and commit only the approved public result back to Solana.
- **Why it matters:** Survivors should not expose raw documents, private evidence context, or professional certification uploads to a public DAO vote. MagicBlock-style Private Ephemeral Rollups give us a pitchable architecture for fast, permissioned, private review.
- **How it can become real:** Add MagicBlock Ephemeral Rollup delegation hooks for proposal/review state, issue access tokens only to verified SBT reviewers, run review logic inside the private execution environment, then commit the final aid decision or SBT claim result to Solana.
- **Hackathon honesty:** This repository currently demonstrates the UX and architecture only. It does not yet call a live MagicBlock rollup or TEE service.

- **当前展示：** DAO 页面有一个 MagicBlock 私密 DAO 审核室前端演示。它展示三步流程：委托私密审核状态、通过 TEE 限权 SBT 审核者访问、只将审核通过后的公开结果提交回 Solana。
- **为什么重要：** 受害者不应把原始文件、私密证据上下文或专业认证材料暴露给公开 DAO 投票。MagicBlock 风格的 Private Ephemeral Rollups 为我们提供了快速、限权、私密审核的可展示架构。
- **如何落地：** 后续可为提案 / 审核状态加入 MagicBlock Ephemeral Rollup delegation hooks，只向已验证 SBT 审核者签发访问令牌，在私密执行环境内完成审核逻辑，再把最终救助决策或 SBT 认领结果提交到 Solana。
- **黑客松诚实说明：** 当前仓库只演示 UX 与架构，不会调用真实 MagicBlock rollup 或 TEE 服务。

---

## Tech Stack | 技术栈

| Layer | Technology |
| --- | --- |
| Frontend | React 18, TypeScript, Vite |
| Styling | Tailwind CSS, shadcn/ui components, lucide-react |
| Auth | Privy email OTP, Phantom wallet signature, local fallback |
| Chain | Solana, Phantom, Solana Memo-style anchoring |
| Storage | Demo Arweave-style vault, IndexedDB, localStorage |
| Encryption | Web Crypto API, AES-256-GCM |
| P2P Demo | Gun.js for support/chat/DAO demo broadcasts |
| Map Alerts | OpenStreetMap tiles, local alert records, color-graded zones |
| Privacy Compute Demo | MagicBlock Private Ephemeral Rollup-style DAO review simulation |

---

## Getting Started | 本地运行

```bash
npm install
npm run dev
```

Open the local Vite URL shown in the terminal, usually:

```text
http://localhost:5173/
```

Build for production:

```bash
npm run build
```

---

## Environment | 环境变量

Create `.env.local` when using real Privy email OTP:

```bash
VITE_PRIVY_APP_ID=your_privy_app_id
VITE_SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
```

`VITE_PRIVY_APP_ID` enables real Privy email OTP signup. Without it, the app still runs for demos with Phantom signup and limited email-contact identity.

`VITE_SOLANA_RPC_URL` can be used for future production RPC configuration. The current evidence anchoring demo can fall back to simulation so judges can test the flow without funds.

---

## Demo Notes | Demo 说明

- Some Web3 operations intentionally have simulation fallbacks so the hackathon demo works without paid infrastructure or wallet funding.
- Certification upload in the DAO tab is front-end-only for now; a production version should send documents to a secure review backend or privacy-preserving credential issuer.
- MagicBlock integration is currently a visible UX/architecture simulation in the DAO tab. In production, it can be used for private DAO review rooms, expert SBT verification, survivor aid proposal review, and fast private state transitions before Solana settlement.
- Map and support alerts include built-in demo examples for presentation purposes.
- Private evidence keys are user-held. Losing the downloaded key bundle can make encrypted evidence unrecoverable in a production design.

- 部分 Web3 操作为确保黑客松演示稳定，保留模拟回退。
- DAO 专业认证上传目前仅为前端 Demo；正式版本应接入安全审核后端或隐私凭证签发机制。
- MagicBlock 当前是 DAO 页面中可见的 UX / 架构模拟。正式版本可用于私密 DAO 审核室、专家 SBT 认证、受害者救助提案审核，以及在 Solana 结算前完成快速私密状态转换。
- 地图与支援页面内置演示案例，便于评审直接理解。
- 私密证据密钥由用户保存；正式版本中若遗失密钥，可能无法恢复加密证据。

---

## Team Members | 团队成员

- Gu Shi: https://github.com/hesta1218-collab
- Wendy Wu: https://github.com/DancinWendy
- Liz Wu: https://github.com/touhouzigei-crypto
- Katie Lin: https://github.com/katielin0207-dev
