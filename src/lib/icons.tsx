import type { FC, SVGProps } from 'react';

type IconProps = { size?: number } & SVGProps<SVGSVGElement>;

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const
});

export const IconCheck: FC<IconProps> = ({ size = 20, ...rest }) => (
  <svg {...base(size)} {...rest}><polyline points="20 6 9 17 4 12" /></svg>
);
export const IconClose: FC<IconProps> = ({ size = 20, ...rest }) => (
  <svg {...base(size)} {...rest}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
);
export const IconUser: FC<IconProps> = ({ size = 20, ...rest }) => (
  <svg {...base(size)} {...rest}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
);
export const IconLogout: FC<IconProps> = ({ size = 20, ...rest }) => (
  <svg {...base(size)} {...rest}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);
export const IconBook: FC<IconProps> = ({ size = 20, ...rest }) => (
  <svg {...base(size)} {...rest}>
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </svg>
);
export const IconLayers: FC<IconProps> = ({ size = 20, ...rest }) => (
  <svg {...base(size)} {...rest}>
    <polygon points="12 2 2 7 12 12 22 7 12 2" />
    <polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" />
  </svg>
);
export const IconEdit: FC<IconProps> = ({ size = 20, ...rest }) => (
  <svg {...base(size)} {...rest}>
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);
export const IconAward: FC<IconProps> = ({ size = 20, ...rest }) => (
  <svg {...base(size)} {...rest}>
    <circle cx="12" cy="8" r="6" />
    <path d="M15.5 13.5L17 22l-5-3-5 3 1.5-8.5" />
  </svg>
);
export const IconChart: FC<IconProps> = ({ size = 20, ...rest }) => (
  <svg {...base(size)} {...rest}>
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
  </svg>
);
export const IconClock: FC<IconProps> = ({ size = 20, ...rest }) => (
  <svg {...base(size)} {...rest}>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);
export const IconPlay: FC<IconProps> = ({ size = 20, ...rest }) => (
  <svg {...base(size)} {...rest}><polygon points="6 4 20 12 6 20 6 4" fill="currentColor" stroke="none" /></svg>
);
export const IconArrowLeft: FC<IconProps> = ({ size = 20, ...rest }) => (
  <svg {...base(size)} {...rest}><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
);
export const IconArrowRight: FC<IconProps> = ({ size = 20, ...rest }) => (
  <svg {...base(size)} {...rest}><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
);
export const IconHome: FC<IconProps> = ({ size = 20, ...rest }) => (
  <svg {...base(size)} {...rest}>
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);
export const IconUsers: FC<IconProps> = ({ size = 20, ...rest }) => (
  <svg {...base(size)} {...rest}>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
export const IconPlus: FC<IconProps> = ({ size = 20, ...rest }) => (
  <svg {...base(size)} {...rest}>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);
export const IconTrash: FC<IconProps> = ({ size = 20, ...rest }) => (
  <svg {...base(size)} {...rest}>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6" /><path d="M14 11v6" />
  </svg>
);
export const IconList: FC<IconProps> = ({ size = 20, ...rest }) => (
  <svg {...base(size)} {...rest}>
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" />
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);
export const IconUserPlus: FC<IconProps> = ({ size = 20, ...rest }) => (
  <svg {...base(size)} {...rest}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="8.5" cy="7" r="4" />
    <line x1="20" y1="8" x2="20" y2="14" />
    <line x1="23" y1="11" x2="17" y2="11" />
  </svg>
);

export const LOGO = ({ size = 32 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 32 32">
    <rect width="32" height="32" rx="9" fill="#4f46e5" />
    <path d="M11 11.5A1.5 1.5 0 0 1 13.2 10.2l7 4.5a1.5 1.5 0 0 1 0 2.6l-7 4.5A1.5 1.5 0 0 1 11 20.5v-9z" fill="#fff" />
  </svg>
);
export const IconFileText: FC<IconProps> = ({ size = 20, ...rest }) => (
  <svg {...base(size)} {...rest}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
  </svg>
);
export const IconSparkles: FC<IconProps> = ({ size = 20, ...rest }) => (
  <svg {...base(size)} {...rest}>
    <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
    <path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15z" />
  </svg>
);
export const IconUpload: FC<IconProps> = ({ size = 20, ...rest }) => (
  <svg {...base(size)} {...rest}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);
export function IconBuilding({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 21h18" />
      <path d="M5 21V7l7-4 7 4v14" />
      <line x1="9" y1="9" x2="9" y2="9.01" />
      <line x1="15" y1="9" x2="15" y2="9.01" />
      <line x1="9" y1="13" x2="9" y2="13.01" />
      <line x1="15" y1="13" x2="15" y2="13.01" />
      <line x1="9" y1="17" x2="9" y2="17.01" />
      <line x1="15" y1="17" x2="15" y2="17.01" />
    </svg>
  );
}