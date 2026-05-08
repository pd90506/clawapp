// Icon set — minimal stroke icons, 16/18/20px
type IconProps = { size?: number; sw?: number; fill?: string };

const Icon = ({ d, size = 16, sw = 1.6, fill = "none" }: { d: React.ReactNode } & IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={fill}
    stroke="currentColor"
    strokeWidth={sw}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {d}
  </svg>
);

export const PlusIcon = (p: IconProps) => <Icon {...p} d={<><path d="M12 5v14"/><path d="M5 12h14"/></>} />;
export const CogIcon = (p: IconProps) => <Icon {...p} d={<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h0a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></>} />;
export const ChevLIcon = (p: IconProps) => <Icon {...p} d={<polyline points="15 18 9 12 15 6"/>} />;
export const ChevRIcon = (p: IconProps) => <Icon {...p} d={<polyline points="9 18 15 12 9 6"/>} />;
export const SidebarIcon = (p: IconProps) => <Icon {...p} d={<><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></>} />;
export const RPanelIcon = (p: IconProps) => <Icon {...p} d={<><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="15" y1="3" x2="15" y2="21"/></>} />;
export const LinkIcon = (p: IconProps) => <Icon {...p} d={<><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></>} />;
export const ActivityIcon = (p: IconProps) => <Icon {...p} d={<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>} />;
export const ClockIcon = (p: IconProps) => <Icon {...p} d={<><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 16 14"/></>} />;
export const PinIcon = (p: IconProps) => <Icon {...p} d={<><path d="M12 17v5"/><path d="M9 10.7V4h6v6.7l3 3.3H6z"/></>} />;
export const ArchiveIcon = (p: IconProps) => <Icon {...p} d={<><rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8"/><line x1="10" y1="13" x2="14" y2="13"/></>} />;
export const BoltIcon = (p: IconProps) => <Icon {...p} d={<polygon points="13 2 4 14 11 14 11 22 20 10 13 10"/>} />;
export const SearchIcon = (p: IconProps) => <Icon {...p} d={<><circle cx="11" cy="11" r="6"/><line x1="20" y1="20" x2="16" y2="16"/></>} />;
export const FolderIcon = (p: IconProps) => <Icon {...p} d={<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>} />;
export const FilterIcon = (p: IconProps) => <Icon {...p} d={<polyline points="3 5 10 13 10 19 14 21 14 13 21 5"/>} />;
export const SortIcon = (p: IconProps) => <Icon {...p} d={<><path d="M3 6h18"/><path d="M6 12h12"/><path d="M10 18h4"/></>} />;
export const DocIcon = (p: IconProps) => <Icon {...p} d={<><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="14 3 14 9 20 9"/></>} />;
export const SlashIcon = (p: IconProps) => <Icon {...p} d={<line x1="17" y1="5" x2="7" y2="19"/>} />;
export const BulbIcon = (p: IconProps) => <Icon {...p} d={<><path d="M9 18h6"/><path d="M10 21h4"/><path d="M12 3a6 6 0 0 0-3 11l1 2h4l1-2a6 6 0 0 0-3-11z"/></>} />;
export const StopIcon = (p: IconProps) => <Icon {...p} d={<rect x="6" y="6" width="12" height="12" rx="1"/>} fill="currentColor" />;
export const XIcon = (p: IconProps) => <Icon {...p} d={<><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></>} />;
