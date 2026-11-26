import { uiAssetBase } from "../asset";
// Copyright (C) 2025 Guyutongxue & CherryC9H13N
// Copyright (C) 2026 Piovium Labs
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as
// published by the Free Software Foundation, either version 3 of the
// License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

export interface ChessboardBackgroundProps {
  color?: string;
}

export function ChessboardBackground(props: ChessboardBackgroundProps) {
  const wide = (globalThis as { __WIDE_BOARD__?: boolean }).__WIDE_BOARD__ === true;
  return (
    <div
      class={
        wide
          ? "w-full h-full z-0 chessboard-bg-container"
          : "aspect-ratio-[16/9] max-h-full max-w-full z-0 chessboard-bg-container"
      }
      style={{ "background-color": props.color ?? "#537a76" }}
    >
      <img
        class={wide ? "w-full h-full" : "w-240 h-135 scale-107.2"}
        src={`${uiAssetBase()}ChessboardBackground${wide ? "-20x9" : ""}.webp`}
        draggable="false"
      />
    </div>
  );
}
