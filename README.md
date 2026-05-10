![Auto Assign](https://github.com/The-unmuted/demo-repository/actions/workflows/auto-assign.yml/badge.svg)

![Proof HTML](https://github.com/The-unmuted/demo-repository/actions/workflows/proof-html.yml/badge.svg)

# The Unmuted | 非默

> *Make truth indelible; ensure no survivor stands alone.*  
> *让真相不可磨灭，让受害者不再孤身一人。*

**The Unmuted** is a bilingual, mobile-first safety demo for anonymous reporting, evidence preservation, community support, and DAO-based survivor aid. It combines privacy-preserving identity, Solana/Phantom wallet support, email OTP signup through Privy, local encryption, demo on-chain proof, live-location SOS flow, map-based risk awareness, and professional SBT verification.

**非默** 是一款双语、移动端优先的安全互助 Demo，面向匿名求助、证据保存、社区支持与 DAO 救助治理。当前版本整合了隐私身份、Solana / Phantom 钱包、Privy 邮箱 OTP 注册、本地加密、演示链上存证、实时位置 SOS、地图风险展示，以及专业人士 SBT 认证流程。

---

## Current Demo | 当前版本

- **Bilingual UI:** English and Chinese switch with one button; the app does not show both languages at the same time.
- **First-time signup:** Users sign up once, then stay signed in locally. Signup supports Phantom wallet signature or email contact/Privy OTP.
- **Soft safety design:** Gentle pink and purple interface, mark-only logo, and the banner “secure, record, protect, speak.”
- **Main flow:** The first page centers the SOS emergency report; after-report evidence is a smaller subordinate flow.
- **Bottom tabs:** Help, Map, Support, and DAO.

- **双语界面：** 中英文通过按钮切换，不会同时显示两种语言。
- **首次注册：** 用户首次进入需要注册，之后在本地保持登录状态。支持 Phantom 钱包签名，也支持邮箱联系方式 / Privy OTP。
- **柔和安全视觉：** 粉紫色系、纯图形 Logo，以及 “secure, record, protect, speak / 安全，记录，守护，发声” 标语。
- **主流程：** 首页突出 SOS 紧急上报，事后证据整理作为次级入口。
- **底部导航：** Help、Map、Support、DAO。

---

## Core Features | 核心功能

### 1. SOS Emergency Report | SOS 紧急上报

- One primary SOS button for immediate emergency reporting.
- Optional silent/voice deterrent behavior is simplified into the current emergency flow.
- Live location can be attached to the emergency alert for supporter response.
- Emergency and non-emergency help are separated clearly in the Support tab.

- 一个核心 SOS 按钮用于紧急求助。
- 将复杂的多步骤触发整合进主 SOS 流程。
- 可附带实时位置，便于支持者响应。
- 在 Support 页面中区分 SOS 紧急求助与社区非紧急支持。

### 2. Secure Evidence Vault | 安全证据库

- Photo, video, and audio evidence can be encrypted locally with AES-256-GCM.
- Encrypted evidence is stored in a demo Arweave-style vault.
- Hashes are anchored through a Solana Memo-style proof flow, with simulation fallback for demo reliability.
- Users can download a local key bundle for later decryption.

- 图片、视频、音频可在本地通过 AES-256-GCM 加密。
- 加密证据进入演示版 Arweave 风格存证库。
- 哈希通过 Solana Memo 风格流程进行时间证明，Demo 中支持模拟回退。
- 用户可下载本地密钥包以便后续解密。

### 3. Map | 地图

- Shows demo risk reports connected to real map coordinates.
- Uses color legend counts to explain clustered area risk.
- Shows user location on the map after location permission.
- Supports map drag, zoom in/out, and map-local scrolling so the page does not scroll when the user scrolls inside the map.

- 展示绑定真实地图坐标的演示风险上报。
- 通过颜色图例和数量表达区域风险聚合。
- 授权定位后在地图中显示用户位置。
- 支持拖动、缩放，并让地图内部滚动独立于页面滚动。

### 4. Support | 社区支持

- Support mode lets community members watch nearby requests.
- SOS support alerts and community help requests are shown separately.
- Demo examples are included directly in the support alerts UI for hackathon judging.
- Supporters can open encrypted P2P-style chat rooms for follow-up.

- 支持者模式可查看附近求助。
- SOS 紧急支持与社区非紧急帮助分开展示。
- 为黑客松评审内置演示案例。
- 支持者可进入端到端加密风格的匿名聊天室继续沟通。

### 5. DAO | DAO 治理与救助

- Survivors can create aid proposals for legal, mental health, or community support.
- DAO voting is tied to anonymous identity, reducing repeated random identities.
- Professionals can claim SBT-style credentials for expert endorsements.
- The professional SBT flow includes a front-end-only certification upload page for demo review.

- 受害者可发起法律、心理或社区支持提案。
- DAO 投票绑定匿名身份，降低重复随机身份带来的滥用。
- 专业人士可认领 SBT 风格认证，提供专家背书。
- 专业 SBT 认领包含前端演示版认证材料上传页面。

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
- Map and support alerts include built-in demo examples for presentation purposes.
- Private evidence keys are user-held. Losing the downloaded key bundle can make encrypted evidence unrecoverable in a production design.

- 部分 Web3 操作为确保黑客松演示稳定，保留模拟回退。
- DAO 专业认证上传目前仅为前端 Demo；正式版本应接入安全审核后端或隐私凭证签发机制。
- 地图与 Support 页面内置演示案例，便于评审直接理解。
- 私密证据密钥由用户保存；正式版本中若遗失密钥，可能无法恢复加密证据。

---

## Team Members | 团队成员

- Gu Shi: https://github.com/hesta1218-collab
- Wendy Wu: https://github.com/DancinWendy
- Liz Wu: https://github.com/touhouzigei-crypto
- Katie Lin: https://github.com/katielin0207-dev
