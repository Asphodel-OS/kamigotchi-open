# Licensing

Kamigotchi's code is open source under the AGPL. The game's art, sound, writing and brand are not.

## Code

Copyright (C) 2023-2026 Asphodel Studios, Inc. and the Kamigotchi contributors.

The source code is licensed under the GNU Affero General Public License, version 3 only (AGPL-3.0-only). The full text is in [LICENSE](LICENSE). A file whose `SPDX-License-Identifier` header names another license is under that license instead.

In short: you may use, study, change and share the code. If you distribute a modified version, or run one that people use over a network, you must offer its complete source under the same license and mark it as modified.

The AGPL is a copyright license. It grants no rights to the Kamigotchi or Asphodel names and logos. Those stay with Asphodel, so a modified version needs its own name and must not present itself as Kamigotchi or as made or endorsed by Asphodel.

## Game content

Copyright (C) 2023-2026 Asphodel Studios, Inc. and its licensors. All rights reserved.

The AGPL does not cover the game's content. None of it is licensed for reuse, except as stated under "Community use" below:

- **Art:** images, sprites, animations, backgrounds and screenshots, including everything under `packages/client/src/assets/images/` and `static/readme/`.
- **Sound:** the effects under `packages/client/src/assets/sound/` and the soundtrack the game loads from its CDN.
- **Writing:** lore, dialogue, and the names and descriptions of Kami, items, NPCs, rooms, quests and skills, wherever they appear. This includes the world data under `packages/contracts/deployment/world/data/`.
- **Brand:** the Kamigotchi and Asphodel names and logos.

**Community use.** You may use screenshots, gameplay footage and game content in guides, wikis, videos, streams, fan art, research and tools about Kamigotchi, including monetized videos and streams. You may also use your own Kami as a profile picture. Do not sell the content itself, use it in another game or project, or suggest that Asphodel made or endorses your work. For anything else, ask at acheron@asphodel.io.

## Contributions

Contributions are accepted under the license of the files they change: AGPL-3.0-only, unless the file's `SPDX-License-Identifier` header names another license. New code files are AGPL-3.0-only.

## Third-party components

These keep their own licenses and copyright notices.

| Component                                                                                                                                                                                                  | Where                                                                                                       | License                                                                                                                                     |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| [MUD](https://github.com/latticexyz/mud) v1 by Lattice, via [Asphodel-OS/mud-classic](https://github.com/Asphodel-OS/mud-classic): `solecs`, `recs`, and code from its `network` and `std-client` packages | `packages/contracts/src/solecs/`, parts of `packages/client/src/engine/` and `packages/client/src/workers/` | MIT, Copyright (c) 2022-present Lattice Labs Ltd.                                                                                           |
| [Solmate](https://github.com/transmissions11/solmate) `FixedPointMathLib`                                                                                                                                  | `packages/contracts/src/utils/FixedPointMathLib.sol`                                                        | AGPL-3.0-only                                                                                                                               |
| [Solstat](https://github.com/primitivefinance/solstat) `Gaussian` and `Units` by Primitive                                                                                                                 | `packages/contracts/src/utils/Gaussian.sol`, `packages/contracts/src/utils/Units.sol`                       | AGPL-3.0-only                                                                                                                               |
| Dogica Pixel font by Roberto Mocci                                                                                                                                                                         | `packages/client/src/assets/fonts/dogicapixel.ttf`                                                          | [SIL Open Font License 1.1](https://openfontlicense.org), Reserved Font Name "Dogica Pixel". The license text is embedded in the font file. |
| [Feather](https://github.com/feathericons/feather) icon `shopping-cart`                                                                                                                                    | `packages/client/src/assets/images/icons/actions/cart.svg`                                                  | MIT, Copyright (c) 2013-2023 Cole Bemis                                                                                                     |
| [Material Symbols](https://github.com/google/material-design-icons) icon `open_in_new` by Google                                                                                                           | `packages/client/src/assets/images/icons/misc/OpenInNew.svg`                                                | [Apache-2.0](https://www.apache.org/licenses/LICENSE-2.0)                                                                                   |

The Discord, Ethereum, Arbitrum, Base and Initia names and logos belong to their owners.

### MIT License

This text applies to the MIT-licensed components above, each under its own copyright notice.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## Dependencies

The packages the client and contracts install from npm and Foundry are not part of this repository and keep their own licenses. Nearly all are permissive (MIT, Apache-2.0, BSD or ISC), MUD included. The exception is the wallet login: Privy loads Reown's WalletConnect and AppKit SDKs, which are under Reown's community licenses, not open-source ones. Anyone who builds and distributes the client uses those SDKs under Reown's terms.
