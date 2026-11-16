# 坦克要塞 · Rogue Bastion

实时坦克 Roguelike：守卫护盾核心，逐层清剿敌军，拾取强化一路打通 3 层。

在线试玩：https://holynova.github.io/rogue-bastion/

## 玩法

- **战斗**：WASD / 方向键移动，鼠标瞄准，点击或空格开火；手机端触屏摇杆 + 开火键，默认自动瞄准
- **目标**：消灭每层全部敌军，保护基地护盾核心（150 点护盾）
- **强化**：每清一层三选一（分裂炮管 / 高爆弹 / 纳米修复等 6 种，含 1 次刷新）
- **楼层**：3 层（绿野前线 / 河谷裂带 / 钢铁要塞），敌军 10 / 12 / 14 机，含侦察 / 突击 / 重装 / 导弹 4 种

## 技术

- Phaser 3.90（本地 vendored，`js/phaser.min.js`）+ 纯 JS，零构建
- 美术：全部用代码画的原创卡通像素精灵（`js/sprites.js`），以 v2 卡通像素原型为视觉基准
- 字体：Fusion Pixel（SIL OFL 1.1，见 `fonts/OFL.txt`）
- 数值底本：holynova/battle-city-roguelike（仅复用设计数值，代码与美术全部重做）

## 本地运行

```sh
python3 -m http.server 8000
# 打开 http://127.0.0.1:8000/
```

## 测试

```sh
node tests/test-logic.js   # 纯逻辑测试（地图 / 楼层 / 抽取 / 强化 / 连杀）
```

## MVP 状态（v0.1）

- [x] 主菜单 / 战斗 / 强化三选一 / 结算（胜负）/ 3 层
- [ ] 音效、更多武器、军械库永久升级、排行榜、更多楼层
