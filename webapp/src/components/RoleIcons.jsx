import { useId } from 'react';

/// The four role icons, drawn for FarmSense Brew in the same style as the
/// Phosphor duotone icons used everywhere else: 256 grid, 16-unit round
/// strokes, a 20% fill layer, and currentColor so each role keeps its accent.
/// Masks hide the lines that sit behind a hat, a crate or a laptop.
function RoleSvg({ size = '1.25em', children, style, className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width={size} height={size}
      fill="none" stroke="currentColor" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"
      style={style} className={className} aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const tint = { fill: 'currentColor', stroke: 'none', opacity: 0.2 };
const useMaskId = () => `m${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

/// Field staff: wide-brim hat, overalls, and a hayfork for the field work.
export function IconFieldStaff(props) {
  const m = useMaskId();
  return (
    <RoleSvg {...props}>
      <mask id={m}>
        <rect width="256" height="256" fill="#fff" />
        <path d="M78 88 L84 48 Q112 32 140 48 L146 88 Z" fill="#000" />
      </mask>
      <path d="M86 86 L90 54 Q112 42 134 54 L138 86 Z" {...tint} />
      <path d="M86 86 L90 54 Q112 42 134 54 L138 86" />
      <path d="M56 88 H168" />
      <g mask={`url(#${m})`}>
        <circle cx="112" cy="112" r="36" />
      </g>
      <path d="M36 228 C46 194 76 172 112 172 C148 172 178 194 188 228" />
      <path d="M90 228 V196 H134 V228 Z" {...tint} />
      <path d="M90 228 V196 H134 V228 M90 196 L82 178 M134 196 L142 178" />
      <path d="M200 36 V60 A16 16 0 0 0 232 60 V36 M216 36 V228" />
    </RoleSvg>
  );
}

/// Farm owner: hat, holding a crate of coffee cherries and a seedling.
export function IconFarmOwner(props) {
  const m = useMaskId();
  return (
    <RoleSvg {...props}>
      <mask id={m}>
        <rect width="256" height="256" fill="#fff" />
        <path d="M92 76 L98 36 Q128 20 158 36 L164 76 Z" fill="#000" />
        <rect x="64" y="134" width="128" height="104" rx="10" fill="#000" />
      </mask>
      <path d="M100 74 L104 44 Q128 32 152 44 L156 74 Z" {...tint} />
      <path d="M100 74 L104 44 Q128 32 152 44 L156 74" />
      <path d="M70 76 H186" />
      <g mask={`url(#${m})`}>
        <circle cx="128" cy="98" r="34" />
        <path d="M44 228 C56 192 88 168 128 168 C168 168 200 192 212 228" />
      </g>
      <rect x="72" y="176" width="112" height="52" rx="6" {...tint} />
      <rect x="72" y="176" width="112" height="52" rx="6" />
      <path d="M72 202 H184" />
      <circle cx="100" cy="162" r="9" />
      <circle cx="124" cy="160" r="9" />
      <path d="M158 176 V144 M158 156 C146 156 138 146 138 134 C150 134 158 142 158 156 M158 148 C158 136 166 126 178 126 C178 138 170 148 158 148" />
    </RoleSvg>
  );
}

/// Agronomist: glasses and a lab coat, holding up a seedling in a test tube.
export function IconAgronomist(props) {
  return (
    <RoleSvg {...props}>
      <path d="M72 100 A40 40 0 0 1 152 100 Q112 74 72 100 Z" {...tint} />
      <circle cx="112" cy="100" r="40" />
      <g strokeWidth="12">
        <circle cx="97" cy="106" r="11" />
        <circle cx="127" cy="106" r="11" />
        <path d="M108 106 H116" />
      </g>
      <path d="M32 228 C42 194 74 172 112 172 C150 172 182 194 192 228" />
      <path d="M90 178 L112 210 L134 178 M112 210 V228" />
      <path d="M202 166 V180 A10 10 0 0 0 222 180 V166 Z" {...tint} />
      <path d="M196 112 V180 A16 16 0 0 0 228 180 V112 M188 112 H236" />
      <path d="M212 148 V84 M212 108 C196 108 186 96 186 80 C202 80 212 92 212 108 M212 96 C212 80 222 68 238 68 C238 84 228 96 212 96" />
    </RoleSvg>
  );
}

/// Administrator: at a laptop, with the system's gear behind.
export function IconAdmin(props) {
  const m = useMaskId();
  const teeth = [0, 45, 90, 135, 180, 225, 270, 315];
  return (
    <RoleSvg {...props}>
      <mask id={m}>
        <rect width="256" height="256" fill="#fff" />
        <circle cx="108" cy="92" r="52" fill="#000" />
        <rect x="46" y="154" width="124" height="80" rx="10" fill="#000" />
      </mask>
      <g mask={`url(#${m})`}>
        <circle cx="188" cy="76" r="30" />
        <circle cx="188" cy="76" r="8" />
        <g strokeLinecap="butt" strokeWidth="20">
          {teeth.map((a) => (
            <path key={a} d="M188 38 V24" transform={`rotate(${a} 188 76)`} />
          ))}
        </g>
        <path d="M28 220 C40 184 70 160 108 160 C146 160 176 184 188 220" />
      </g>
      <circle cx="108" cy="92" r="38" />
      <rect x="56" y="164" width="104" height="56" rx="6" {...tint} />
      <rect x="56" y="164" width="104" height="56" rx="6" />
      <path d="M36 228 H180" />
      <circle cx="108" cy="192" r="6" fill="currentColor" stroke="none" />
    </RoleSvg>
  );
}
