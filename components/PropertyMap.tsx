"use client";
import type { Cabin } from "@/lib/catalog";
export function PropertyMap({
  cabins,
  selected,
  onSelect,
  compact = false,
}: {
  cabins: Cabin[];
  selected: number;
  onSelect: (id: number) => void;
  compact?: boolean;
}) {
  return (
    <div className={`property-map ${compact ? "compact-map" : ""}`}>
      <svg
        viewBox="0 0 900 620"
        role="img"
        aria-label="Illustrated property map showing woodland, cabins, shore path and sauna. Use the numbered cabin buttons to explore."
      >
        <defs>
          <pattern
            id="map-paper"
            width="6"
            height="6"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="1" cy="2" r="0.35" fill="#8b9882" opacity=".25" />
          </pattern>
          <pattern
            id="sea-lines"
            width="100"
            height="36"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M0 18q25-8 50 0t50 0"
              fill="none"
              stroke="#7da29b"
              strokeWidth=".55"
              opacity=".65"
            />
          </pattern>
          <g id="map-tree">
            <path
              d="M0 0l-7 13h4l-8 12h8l-6 10H9L3 25h8L3 13h4Z"
              fill="#adb7a0"
              stroke="#7f927b"
              strokeWidth=".8"
            />
            <path d="M0 16v25" stroke="#6f856c" strokeWidth=".9" />
          </g>
        </defs>
        <rect width="900" height="620" fill="#eeeade" />
        <rect width="900" height="620" fill="url(#map-paper)" />
        <path
          d="M791-15C770 62 706 84 734 156S825 239 790 299 730 357 801 430 760 530 735 639H920V-15Z"
          fill="#b7d0c9"
        />
        <path
          d="M812-15C792 62 730 84 758 156S848 239 815 299 754 357 826 430 785 530 760 639H920V-15Z"
          fill="url(#sea-lines)"
        />
        <path
          d="M767-15C746 62 682 84 710 156S801 239 766 299 706 357 777 430 736 530 711 639"
          fill="none"
          stroke="#d2c6ae"
          strokeWidth="20"
        />
        <path
          d="M775-15C754 62 690 84 718 156S809 239 774 299 714 357 785 430 744 530 719 639"
          fill="none"
          stroke="#faf6e9"
          strokeWidth="5"
        />
        <path
          d="M-10 64Q167 13 271 87t215-15M-10 95Q158 40 269 114t227-8M-10 128Q157 76 258 146t247 0M68 528Q224 419 337 515t186 36M76 551Q234 450 344 540t197 36M72 581Q234 476 344 566t197 35"
          fill="none"
          stroke="#c5cab7"
          strokeWidth="1"
        />
        {Array.from({ length: 37 }, (_, i) => {
          const x = 65 + ((i * 137) % 570),
            y = 55 + ((i * 89) % 490);
          return (
            <use
              key={i}
              href="#map-tree"
              transform={`translate(${x} ${y}) scale(${0.6 + (i % 4) * 0.13})`}
              opacity={0.48 + (i % 3) * 0.15}
            />
          );
        })}
        <path
          d="M135 622C182 538 249 550 258 457S332 356 434 353 529 250 596 230 652 166 630 130M434 353Q614 327 692 390M258 457Q352 417 425 470"
          fill="none"
          stroke="#c7b99c"
          strokeWidth="11"
        />
        <path
          d="M135 622C182 538 249 550 258 457S332 356 434 353 529 250 596 230 652 166 630 130M434 353Q614 327 692 390M258 457Q352 417 425 470"
          fill="none"
          stroke="#faf6ec"
          strokeWidth="6"
          strokeDasharray="2 3"
        />
        {cabins.map((c) => (
          <g
            key={c.id}
            transform={`translate(${c.x * 9 - 38} ${c.y * 6.2 + 20}) rotate(-20)`}
          >
            <rect
              x="0"
              y="0"
              width="46"
              height="26"
              fill="#f7f3e8"
              stroke="#657b68"
              strokeWidth="1.5"
            />
            <path
              d="M-4 13 23-6l27 19-27 20Z"
              fill="#7d8b74"
              stroke="#516a56"
            />
            <path d="M23-6v39" stroke="#dfe3d1" />
            <path d="M0 26h46v8H0Z" fill="#d1c2a3" stroke="#8d987e" />
          </g>
        ))}
        <g transform="translate(595 487) rotate(-20)">
          <rect width="30" height="20" fill="#818972" />
          <path d="M-3 10 15-4l18 14-18 13Z" fill="#a5ad8c" stroke="#617459" />
        </g>
        <g
          fontFamily="Georgia,serif"
          fontSize="17"
          fontStyle="italic"
          fill="#536c60"
        >
          <text x="73" y="252" transform="rotate(-12 73 252)">
            the woodland
          </text>
          <text x="378" y="170" transform="rotate(-8 378 170)">
            salt meadow
          </text>
          <text x="596" y="541">
            the sauna
          </text>
          <text x="810" y="220" transform="rotate(90 810 220)">
            the Atlantic, beyond
          </text>
        </g>
        <g transform="translate(76 470)" stroke="#637869" fill="none">
          <circle r="23" />
          <path d="M0-35V35M-12 0h24M0-25l-5 13H5Z" fill="#637869" />
          <text
            x="-5"
            y="-44"
            stroke="none"
            fill="#637869"
            fontFamily="serif"
            fontSize="15"
          >
            N
          </text>
        </g>
        <text
          x="115"
          y="582"
          fontFamily="sans-serif"
          fontSize="10"
          letterSpacing="2"
          fill="#536c60"
        >
          ARRIVAL
        </text>
      </svg>
      <div className="map-pins">
        {cabins.map((c) => (
          <button
            key={c.id}
            className={`map-pin ${selected === c.id ? "selected" : ""}`}
            style={{ left: `${c.x}%`, top: `${c.y}%` }}
            aria-label={`Explore ${c.name}`}
            aria-pressed={selected === c.id}
            onClick={() => onSelect(c.id)}
          >
            <span>{String(c.id).padStart(2, "0")}</span>
            <span className="pin-label">{c.name}</span>
          </button>
        ))}
      </div>
      <div className="map-caption">
        <span>THE TIDEHOUSE GROUNDS</span>
        <span>An illustrated guide, not to scale</span>
      </div>
    </div>
  );
}
export function FloorPlan({ cabin }: { cabin: Cabin }) {
  const family = cabin.capacity === 4;
  return (
    <div className="floor-plan">
      <svg
        viewBox="0 0 600 360"
        role="img"
        aria-label={`${cabin.name} illustrative floor plan: ${family ? "two bedrooms" : "one bedroom"}, bathroom, kitchen, living room and private deck. Not to scale.`}
      >
        <defs>
          <pattern
            id="deck-lines"
            width="10"
            height="10"
            patternUnits="userSpaceOnUse"
          >
            <path d="M0 0v10" stroke="#c5c2b1" strokeWidth="1" />
          </pattern>
        </defs>
        <rect
          x="55"
          y="275"
          width="490"
          height="52"
          fill="url(#deck-lines)"
          stroke="#9aab99"
        />
        <path
          d="M55 275V40h490v235H325m-65 0H55M260 40v180m0 45v10M425 40v100h120M260 175h285"
          fill="none"
          stroke="#4d6a59"
          strokeWidth="4"
        />
        {family && (
          <path
            d="M165 40v135H55"
            fill="none"
            stroke="#4d6a59"
            strokeWidth="3"
          />
        )}
        <rect
          x="78"
          y="67"
          width={family ? 64 : 132}
          height="75"
          rx="3"
          fill="#e4e7d9"
          stroke="#829781"
        />
        <path d={family ? "M81 84h56" : "M81 84h126"} stroke="#829781" />
        {family && (
          <rect
            x="182"
            y="67"
            width="61"
            height="75"
            rx="3"
            fill="#e4e7d9"
            stroke="#829781"
          />
        )}
        <rect
          x="288"
          y="65"
          width="100"
          height="24"
          fill="#e2dfd0"
          stroke="#859280"
        />
        <circle cx="308" cy="77" r="6" fill="none" stroke="#859280" />
        <circle cx="328" cy="77" r="6" fill="none" stroke="#859280" />
        <rect
          x="447"
          y="58"
          width="65"
          height="40"
          fill="none"
          stroke="#859280"
        />
        <circle cx="487" cy="122" r="10" fill="none" stroke="#859280" />
        <rect
          x="445"
          y="195"
          width="72"
          height="25"
          rx="3"
          fill="#e2dfd0"
          stroke="#859280"
        />
        <circle cx="387" cy="227" r="22" fill="none" stroke="#859280" />
        <path
          d="M325 275a65 65 0 0 0-65-65v65"
          fill="none"
          stroke="#859280"
          strokeDasharray="3 3"
        />
        <g
          fill="#536b5a"
          fontFamily="sans-serif"
          fontSize="11"
          letterSpacing="1.5"
        >
          <text x="88" y="165">
            {family ? "BEDROOMS" : "KING BED"}
          </text>
          <text x="300" y="125">
            KITCHEN
          </text>
          <text x="440" y="159">
            BATH
          </text>
          <text x="323" y="258">
            LIVING
          </text>
          <text x="230" y="308">
            PRIVATE DECK
          </text>
        </g>
      </svg>
      <p>
        {cabin.area} m² interior · {cabin.beds} · Illustrative plan, not to
        scale
      </p>
    </div>
  );
}
