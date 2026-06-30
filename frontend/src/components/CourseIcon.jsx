/**
 * Animated SVG icons for each course, used everywhere course.icon is rendered.
 * Pass size (px number, default 32) and color (default course color via CSS).
 */

export default function CourseIcon({ icon, color = "currentColor", size = 32 }) {
  const s = size;
  switch (icon) {
    case "dsa":
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none" aria-label="Data Structures & Algorithms">
          {/* Binary tree */}
          <circle cx="16" cy="5" r="3.5" fill={color} opacity="0.9" />
          <circle cx="7"  cy="15" r="3" fill={color} opacity="0.75" />
          <circle cx="25" cy="15" r="3" fill={color} opacity="0.75" />
          <circle cx="4"  cy="25" r="2.5" fill={color} opacity="0.6" />
          <circle cx="11" cy="25" r="2.5" fill={color} opacity="0.6" />
          <circle cx="21" cy="25" r="2.5" fill={color} opacity="0.6" />
          <circle cx="28" cy="25" r="2.5" fill={color} opacity="0.6" />
          <line x1="16" y1="8.5" x2="7"  y2="12" stroke={color} strokeWidth="1.5" opacity="0.5" />
          <line x1="16" y1="8.5" x2="25" y2="12" stroke={color} strokeWidth="1.5" opacity="0.5" />
          <line x1="7"  y1="18" x2="4"  y2="22.5" stroke={color} strokeWidth="1.2" opacity="0.4" />
          <line x1="7"  y1="18" x2="11" y2="22.5" stroke={color} strokeWidth="1.2" opacity="0.4" />
          <line x1="25" y1="18" x2="21" y2="22.5" stroke={color} strokeWidth="1.2" opacity="0.4" />
          <line x1="25" y1="18" x2="28" y2="22.5" stroke={color} strokeWidth="1.2" opacity="0.4" />
        </svg>
      );
    case "python":
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none" aria-label="Python">
          {/* Stylised snake / Python logo hint */}
          <path
            d="M16 3C11.58 3 9 5.02 9 8v2h7v1H7.5C5.01 11 3 13.24 3 16s2.01 5 4.5 5H10v-2.5C10 16.01 12.24 14 15 14h5c2.21 0 4-1.79 4-4V8c0-2.98-2.58-5-8-5z"
            fill={color} opacity="0.85"
          />
          <circle cx="13" cy="7.5" r="1" fill="#fff" opacity="0.8" />
          <path
            d="M16 29C20.42 29 23 26.98 23 24v-2h-7v-1h8.5C26.99 21 29 18.76 29 16s-2.01-5-4.5-5H22v2.5C22 15.99 19.76 18 17 18h-5c-2.21 0-4 1.79-4 4v2c0 2.98 2.58 5 8 5z"
            fill={color} opacity="0.65"
          />
          <circle cx="19" cy="24.5" r="1" fill="#fff" opacity="0.8" />
        </svg>
      );
    case "web":
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none" aria-label="Web Development">
          {/* Globe with meridians */}
          <circle cx="16" cy="16" r="12" stroke={color} strokeWidth="1.8" opacity="0.9" />
          <ellipse cx="16" cy="16" rx="5.5" ry="12" stroke={color} strokeWidth="1.4" opacity="0.6" />
          <line x1="4" y1="16" x2="28" y2="16" stroke={color} strokeWidth="1.4" opacity="0.6" />
          <line x1="6"  y1="10" x2="26" y2="10" stroke={color} strokeWidth="1.1" opacity="0.4" />
          <line x1="6"  y1="22" x2="26" y2="22" stroke={color} strokeWidth="1.1" opacity="0.4" />
        </svg>
      );
    case "db":
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none" aria-label="Databases & SQL">
          {/* Stacked cylinders */}
          <ellipse cx="16" cy="8"  rx="10" ry="3.5" fill={color} opacity="0.9" />
          <rect x="6" y="8" width="20" height="6" fill={color} opacity="0.55" />
          <ellipse cx="16" cy="14" rx="10" ry="3.5" fill={color} opacity="0.75" />
          <rect x="6" y="14" width="20" height="6" fill={color} opacity="0.4" />
          <ellipse cx="16" cy="20" rx="10" ry="3.5" fill={color} opacity="0.6" />
          <rect x="6" y="20" width="20" height="6" fill={color} opacity="0.28" />
          <ellipse cx="16" cy="26" rx="10" ry="3.5" fill={color} opacity="0.45" />
        </svg>
      );
    case "ml":
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none" aria-label="Machine Learning">
          {/* Neural network nodes */}
          {/* Input layer */}
          <circle cx="5"  cy="10" r="2.8" fill={color} opacity="0.5" />
          <circle cx="5"  cy="16" r="2.8" fill={color} opacity="0.5" />
          <circle cx="5"  cy="22" r="2.8" fill={color} opacity="0.5" />
          {/* Hidden layer */}
          <circle cx="16" cy="8"  r="2.8" fill={color} opacity="0.75" />
          <circle cx="16" cy="16" r="2.8" fill={color} opacity="0.9" />
          <circle cx="16" cy="24" r="2.8" fill={color} opacity="0.75" />
          {/* Output layer */}
          <circle cx="27" cy="13" r="2.8" fill={color} opacity="0.6" />
          <circle cx="27" cy="19" r="2.8" fill={color} opacity="0.6" />
          {/* Connections input→hidden */}
          {[[5,10,16,8],[5,10,16,16],[5,10,16,24],[5,16,16,8],[5,16,16,16],[5,16,16,24],[5,22,16,8],[5,22,16,16],[5,22,16,24]].map(([x1,y1,x2,y2],i) => (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth="0.8" opacity="0.25" />
          ))}
          {/* Connections hidden→output */}
          {[[16,8,27,13],[16,8,27,19],[16,16,27,13],[16,16,27,19],[16,24,27,13],[16,24,27,19]].map(([x1,y1,x2,y2],i) => (
            <line key={i+9} x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth="0.8" opacity="0.25" />
          ))}
        </svg>
      );
    default:
      return null;
  }
}
